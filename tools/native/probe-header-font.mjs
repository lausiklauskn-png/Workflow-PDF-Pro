// Observe the unchanged source's actual platform font and 380px geometry.
// Diagnostic only: does not alter CSS, relax tests or claim a passed layout.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { root } from './prepare-web.mjs';
const base = join(root, 'upstream/workflow-pdf');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(base, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== base && !path.startsWith(base + '/')) throw new Error();
    const file = path === base ? join(path, 'index.html') : path;
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch(process.env.WFP_CHROMIUM ? { executablePath: process.env.WFP_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 380, height: 900 } });
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForFunction(() => Boolean(window.__wfpdf));
  await page.evaluate(() => document.fonts.ready);
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable'); await client.send('CSS.enable');
  const { root: document } = await client.send('DOM.getDocument');
  const fonts = [];
  for (const selector of ['.marke-name', '.marke-name b']) {
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: document.nodeId, selector });
    fonts.push({ selector, ...(await client.send('CSS.getPlatformFontsForNode', { nodeId })) });
  }
  const geometry = await page.evaluate(() => {
    const element = document.querySelector('.marke-name'), range = document.createRange(); range.selectNodeContents(element);
    return { font: getComputedStyle(element).font, text: range.getBoundingClientRect().toJSON(), box: element.getBoundingClientRect().toJSON() };
  });
  const result = JSON.stringify({ browser: browser.version(), fonts, geometry });
  if (process.env.GITHUB_ACTIONS) console.log('::notice title=Unveränderte Quell-Kopfzeile und Systemschrift::' + result.replaceAll('%', '%25'));
  else console.log(result);
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
