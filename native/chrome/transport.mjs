// Executable protocol trial for the Android loopback adapter, not an APK runtime.
// Only already cleaned paragraph arrays enter here. PDF bytes, keys, IDs and
// database records never cross this boundary. The original PDF engine owns them.
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const MAX_BYTES = 16 * 1024 * 1024;
const languages = new Set(['de', 'ru', 'en']);
const assets = new Map([
  ['/', ['text/html; charset=utf-8', new URL('./helper.html', import.meta.url)]],
  ['/helper.js', ['text/javascript; charset=utf-8', new URL('./helper.js', import.meta.url)]],
  ['/uebersetzung.js', ['text/javascript; charset=utf-8', new URL('../../upstream/workflow-pdf/assets/uebersetzung.js', import.meta.url)]]
]);

function paragraphs(value) {
  if (!Array.isArray(value) || !value.every(x => typeof x === 'string')) throw new Error('invalid-paragraphs');
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) throw new Error('transport-message-too-large');
  return value.slice(); // No truncation, coercion or translation in the transport.
}

export async function openChromeTransport({ von, nach, idleMs = 30 * 60 * 1000 } = {}) {
  if (!languages.has(von) || !languages.has(nach) || von === nach) throw new Error('invalid-language-pair');
  if (!(idleMs > 0 && Number.isFinite(idleMs))) throw new Error('invalid-expiry');
  const publicAssets = new Map(await Promise.all([...assets].map(async ([url, [mime, file]]) => [url, { mime, bytes: await readFile(file) }])));
  let secret = randomBytes(32).toString('hex'), origin, batch = null, sequence = 0, closed = false, timer;
  const sockets = new Set();
  const touch = () => { clearTimeout(timer); timer = setTimeout(() => close('session-expired'), idleMs); timer.unref(); };
  const rejectBatch = reason => {
    if (batch) { const old = batch; batch = null; old.reject(new Error(reason)); }
  };
  const close = (reason = 'cancelled') => {
    if (closed) return;
    closed = true; secret = ''; clearTimeout(timer); rejectBatch(reason);
    server.close();
    for (const socket of sockets) socket.destroy();
  };
  const authenticated = header => {
    const supplied = typeof header === 'string' ? header : '';
    const expected = 'Bearer ' + secret;
    return !!secret && Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  };
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (closed) return reply(410, { error: 'session-closed' });
    if (req.headers.host !== new URL(origin).host || req.socket.remoteAddress !== '127.0.0.1') return reply(403, { error: 'host-rejected' });
    if (req.headers.origin && req.headers.origin !== origin) return reply(403, { error: 'origin-rejected' });
    if (req.method === 'OPTIONS') return reply(403, { error: 'cross-origin-disabled' });
    const asset = publicAssets.get(req.url);
    if (req.method === 'GET' && asset) { res.writeHead(200, { 'Content-Type': asset.mime }); res.end(asset.bytes); return; }
    if (!authenticated(req.headers.authorization)) return reply(401, { error: 'session-required' });
    // Browser polling is deliberately not a heartbeat: an abandoned tab must expire.
    if (req.method === 'GET' && req.url === '/batch') return reply(200, batch ? { id: batch.id, von, nach, texte: batch.texte } : { waiting: true });
    if (req.method !== 'POST' || !['/result', '/cancel'].includes(req.url)) return reply(404, { error: 'route-not-found' });
    if (req.headers.origin !== origin) return reply(403, { error: 'origin-required' });
    if (req.headers['content-type'] !== 'application/json') return reply(415, { error: 'json-required' });
    try {
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > MAX_BYTES) { reply(413, { error: 'transport-message-too-large' }); req.resume(); return; }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (req.url === '/cancel') {
        reply(200, { cancelled: true });
        // Reject the awaiting native caller; never deliver an original as a translation.
        setImmediate(() => close('cancelled-in-browser')); return;
      }
      if (!batch || data.id !== batch.id) return reply(409, { error: 'stale-result' });
      if (typeof data.error === 'string') {
        const old = batch; batch = null; old.reject(new Error('chrome-translation-failed')); reply(200, { failed: true }); return;
      }
      const texte = paragraphs(data.texte);
      if (texte.length !== batch.texte.length) return reply(422, { error: 'paragraph-count-mismatch' });
      const stat = {};
      for (const key of ['ohne', 'zeichen', 'anfragen']) {
        const n = data.stat?.[key];
        if (!Number.isSafeInteger(n) || n < 0) return reply(422, { error: 'invalid-statistics' });
        stat[key] = n;
      }
      const old = batch; batch = null; touch();
      old.resolve({ texte, stat }); reply(200, { accepted: true });
    } catch { if (!res.headersSent) reply(400, { error: 'invalid-message' }); }
  });
  server.maxConnections = 8;
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
  touch();
  return Object.freeze({
    // Fragment never enters HTTP requests. Helper removes it before showing text.
    browserURL: origin + '/#' + secret,
    translate(texte) {
      if (closed) return Promise.reject(new Error('session-closed'));
      if (batch) return Promise.reject(new Error('batch-already-pending'));
      let copy; try { copy = paragraphs(texte); } catch (e) { return Promise.reject(e); }
      touch();
      return new Promise((resolve, reject) => { batch = { id: ++sequence, texte: copy, resolve, reject }; });
    },
    close
  });
}
