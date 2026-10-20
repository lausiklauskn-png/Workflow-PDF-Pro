import { createCipheriv, createDecipheriv, createHash, randomBytes, X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, chmod, writeFile, readFile, rm, mkdir, open, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const APP_ID = 'de.familyprojekt.workflowpdf.pro';
export const UNLOCK_NAME = 'WF_PDF_SIGNING_UNLOCK';
const FORMAT = 'workflow-pdf-pro-android-signing';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function unlock(value) {
  if (!/^[a-f0-9]{64}$/i.test(value || '')) throw new Error('WF_PDF_SIGNING_UNLOCK muss ein separat gespeicherter Zufallswert aus 64 Hexzeichen sein.');
  return Buffer.from(value, 'hex');
}

function checked(command, args, env) {
  const childEnv = { ...process.env, ...env };
  delete childEnv[UNLOCK_NAME];
  const run = spawnSync(command, args, { env: childEnv, maxBuffer: 4 * 1024 * 1024 });
  // Subprocess output may include sensitive arguments or paths: never echo it.
  if (run.error || run.status !== 0) throw new Error(command + ' fehlgeschlagen; kein Schlüsselinhalt wird ausgegeben.');
  return run.stdout;
}

export async function privateDirectory(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'wf-pdf-sign-'));
  await chmod(dir, 0o700);
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

export async function publicCertificate(file, password, alias) {
  if (typeof password !== 'string' || !password || !/^[a-z0-9_-]+$/i.test(alias || '')) throw new Error('Ungültige Keystore-Angaben.');
  const der = checked('keytool', ['-exportcert', '-keystore', file, '-storepass:env', 'WF_PDF_STORE_PASSWORD', '-alias', alias], { WF_PDF_STORE_PASSWORD: password });
  return { der, cert: new X509Certificate(der), fingerprint: sha(der) };
}

export async function sealIdentity({ keystore, password, alias, key, expectedFingerprint }) {
  const encryptionKey = unlock(key);
  try {
    return await privateDirectory(async dir => {
      const file = path.join(dir, 'signing.p12');
      await writeFile(file, keystore, { mode: 0o600, flag: 'wx' });
      const { fingerprint } = await publicCertificate(file, password, alias);
      if (expectedFingerprint && fingerprint !== expectedFingerprint.toLowerCase().replace(/:/g, '')) throw new Error('Zertifikat stimmt nicht mit der erwarteten Identität überein.');
      const header = { format: FORMAT, version: 1, algorithm: 'aes-256-gcm', applicationId: APP_ID, certificateSha256: fingerprint };
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
      cipher.setAAD(Buffer.from(JSON.stringify(header)));
      const clear = Buffer.from(JSON.stringify({ alias, password, keystore: Buffer.from(keystore).toString('base64'), keystoreSha256: sha(keystore) }));
      try {
        const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
        return { ...header, nonce: nonce.toString('base64'), ciphertext: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
      } finally { clear.fill(0); }
    });
  } finally { encryptionKey.fill(0); }
}

export async function withIdentity(envelope, key, fn) {
  const encryptionKey = unlock(key);
  let clear;
  try {
    const { format, version, algorithm, applicationId, certificateSha256, nonce, ciphertext, tag } = envelope || {};
    if (format !== FORMAT || version !== 1 || algorithm !== 'aes-256-gcm' || applicationId !== APP_ID || !/^[a-f0-9]{64}$/.test(certificateSha256 || '')) throw new Error('Falsches Signierpaket oder falsche App-Kennung.');
    const decode = (value, size) => {
      if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Ungültige Verschlüsselungsdaten.');
      const bytes = Buffer.from(value, 'base64');
      if (bytes.toString('base64') !== value || (size && bytes.length !== size)) throw new Error('Ungültige Verschlüsselungsdaten.');
      return bytes;
    };
    const iv = decode(nonce, 12), auth = decode(tag, 16), encrypted = decode(ciphertext);
    if (encrypted.length > 1024 * 1024) throw new Error('Signierpaket zu groß.');
    const header = { format, version, algorithm, applicationId, certificateSha256 };
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAAD(Buffer.from(JSON.stringify(header))); decipher.setAuthTag(auth);
    try { clear = Buffer.concat([decipher.update(encrypted), decipher.final()]); }
    catch { throw new Error('Signierpaket nicht authentisch oder Freigabe falsch.'); }
    const content = JSON.parse(clear.toString('utf8'));
    const bytes = Buffer.from(content.keystore, 'base64');
    try {
      if (sha(bytes) !== content.keystoreSha256) throw new Error('Keystore-Prüfsumme stimmt nicht.');
      return await privateDirectory(async dir => {
        const file = path.join(dir, 'signing.p12');
        await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
        const cert = await publicCertificate(file, content.password, content.alias);
        if (cert.fingerprint !== certificateSha256) throw new Error('Signierzertifikat stimmt nicht.');
        return fn({ file, password: content.password, alias: content.alias, fingerprint: cert.fingerprint, certificate: cert.der, directory: dir });
      });
    } finally { bytes.fill(0); content.password = ''; content.keystore = ''; }
  } finally { encryptionKey.fill(0); if (clear) clear.fill(0); }
}

export async function createIdentity(key) {
  const checkedKey = unlock(key); checkedKey.fill(0);
  return privateDirectory(async dir => {
    const file = path.join(dir, 'signing.p12'), password = randomBytes(32).toString('hex'), alias = 'workflow-pdf-pro';
    checked('keytool', ['-genkeypair', '-storetype', 'PKCS12', '-keystore', file,
      '-storepass:env', 'WF_PDF_STORE_PASSWORD', '-keypass:env', 'WF_PDF_STORE_PASSWORD',
      '-alias', alias, '-keyalg', 'RSA', '-keysize', '4096', '-sigalg', 'SHA256withRSA',
      '-validity', '10000', '-dname', 'CN=Workflow PDF Pro,O=Family Projekt,C=DE', '-noprompt'], { WF_PDF_STORE_PASSWORD: password });
    const bytes = await readFile(file);
    try { return await sealIdentity({ keystore: bytes, password, alias, key }); } finally { bytes.fill(0); }
  });
}

export async function saveNewIdentity(directory, envelope) {
  await mkdir(directory, { recursive: true });
  // Neither file may be replaced, even by a partially failed earlier initialization.
  const packagePath = path.join(directory, 'android-release.enc.json');
  const certPath = path.join(directory, 'android-certificate.json');
  for (const file of [packagePath, certPath]) {
    try { await lstat(file); throw new Error('Signieridentität vorhanden; niemals automatisch ersetzen.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const packageHandle = await open(packagePath, 'wx', 0o644);
  try { await packageHandle.writeFile(JSON.stringify(envelope, null, 2) + '\n'); }
  finally { await packageHandle.close(); }
  const metadata = { applicationId: APP_ID, certificateSha256: envelope.certificateSha256, created: new Date().toISOString() };
  await writeFile(certPath, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx', mode: 0o644 });
}

export async function verifyPinnedIdentity(directory, key, fn = () => true) {
  const envelope = JSON.parse(await readFile(path.join(directory, 'android-release.enc.json'), 'utf8'));
  const metadata = JSON.parse(await readFile(path.join(directory, 'android-certificate.json'), 'utf8'));
  if (metadata.applicationId !== APP_ID || metadata.certificateSha256 !== envelope.certificateSha256) throw new Error('Öffentlicher Zertifikats-Pin stimmt nicht.');
  return withIdentity(envelope, key, fn);
}

export { checked };
