import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { root } from './prepare-web.mjs';

test('native reception with real browser/core and a protocol fixture', async t => {
  const base = join(root, 'www');
  const server = createServer(async (req, res) => {
    try {
      const path = resolve(base, '.' + new URL(req.url, 'http://localhost').pathname);
      if (path !== base && !path.startsWith(base + '/')) throw Error();
      const file = path === base ? join(path, 'index.html') : path;
      res.setHeader('Content-Type', ({ '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.wasm':'application/wasm' })[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.statusCode=404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch(process.env.WFP_CHROMIUM ? { executablePath:process.env.WFP_CHROMIUM } : {});
    async function pageFor(mode = 'ok') {
      const page = await browser.newPage({ viewport:{ width:360, height:740 } });
      await page.addInitScript(mode => {
        const f = window.fixture = { queue:[], data:{}, mode, events:[], acks:[], reads:[], changes:0 };
        window.Capacitor = { isNativePlatform:()=>true, Plugins:{ WorkflowIncoming:{
          async addListener(name, cb) { f.events.push(cb); return { remove(){} }; },
          async pending() { return f.queue[0] || { empty:true }; },
          async read({ batch, id, offset }) {
            f.reads.push([batch,id,offset]);
            if (f.mode === 'fail' && id === 'second') throw Error('revoked');
            if (f.mode === 'zero') return { data:'', done:false };
            const bytes=f.data[id].slice(offset,offset+262144);
            let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
            return { data:btoa(binary), done:offset+bytes.length>=f.data[id].length };
          },
          async acknowledge({ id }) {
            if (f.mode === 'ackfail') throw Error('ack failure');
            if (f.queue[0].id !== id) throw Error('wrong batch');
            f.acks.push(id);f.queue.shift();
          }
        } } };
      }, mode);
      await page.goto('http://127.0.0.1:' + server.address().port + '/');
      await page.waitForFunction(() => window.__wfpdf && window.WFPNativeIncoming && window.PDFLib);
      await page.evaluate(async () => {
        const pdf=await PDFLib.PDFDocument.create();pdf.addPage();
        const bytes=await pdf.save();
        // Valid PDF with padding: more than two bridge chunks.
        const padded=new Uint8Array(600001);padded.fill(32);padded.set(bytes);
        fixture.data.first=padded;fixture.data.second=bytes;
        fixture.queue.push({ id:'batch-1', files:[{ id:'first',name:'Мüller.pdf',mime:'application/pdf' },{ id:'second',name:'Teil 2.pdf',mime:'application/pdf' }] });
        document.getElementById('inDatei').addEventListener('change',()=>fixture.changes++);
        fixture.events.forEach(cb=>cb());
      });
      await page.waitForSelector('#nativeIncoming button');
      return page;
    }
    await t.test('no import before consent; complete chunks preserve bytes and manual check status', async () => {
      const page=await pageFor();
      assert.equal(await page.evaluate(() => fixture.changes),0);
      await page.locator('#nativeIncoming button').first().click();
      await page.waitForFunction(() => window.__wfpdf.S.docs.length===2);
      const result=await page.evaluate(async () => {
        const doc=(await WFP.DB.all('docs')).find(d=>d.name==='Мüller');
        return { bytes:Array.from(await WFP.DB.getFile(doc.id)),expected:Array.from(fixture.data.first),check:doc.pruefung||null,acks:fixture.acks,changes:fixture.changes,offsets:fixture.reads.filter(r=>r[1]==='first').map(r=>r[2]) };
      });
      assert.deepEqual(result.bytes,result.expected);assert.equal(result.check,null);
      assert.deepEqual(result.acks,['batch-1']);assert.equal(result.changes,1);assert.deepEqual(result.offsets,[0,262144,524288]);
      await page.close();
    });
    await t.test('later read failure submits nothing, keeps batch and can retry', async () => {
      const page=await pageFor('fail');await page.locator('#nativeIncoming button').first().click();
      await page.waitForFunction(() => document.querySelector('#nativeIncoming p').textContent.includes('nicht vollständig'));
      assert.deepEqual(await page.evaluate(() => [fixture.changes,fixture.acks.length,__wfpdf.S.docs.length]),[0,0,0]);
      await page.evaluate(() => fixture.mode='ok');await page.locator('#nativeIncoming button').first().click();
      await page.waitForFunction(() => __wfpdf.S.docs.length===2);assert.equal(await page.evaluate(() => fixture.changes),1);await page.close();
    });
    await t.test('dismiss preserves library and exposes next warm batch without overwriting it', async () => {
      const page=await pageFor();
      await page.evaluate(() => { fixture.queue.push({ id:'batch-2', files:[{ id:'second',name:'next.pdf',mime:'application/pdf' }] });fixture.events.forEach(cb=>cb()); });
      await page.locator('#nativeIncoming button').nth(1).click();
      await page.waitForFunction(() => document.querySelector('#nativeIncoming')?.textContent.includes('next.pdf'));
      assert.deepEqual(await page.evaluate(() => [fixture.changes,fixture.acks,__wfpdf.S.docs.length]),[0,['batch-1'],0]);await page.close();
    });
    await t.test('ack failure cannot automatically import twice', async () => {
      const page=await pageFor('ackfail');await page.locator('#nativeIncoming button').first().click();
      await page.waitForFunction(() => document.querySelector('#nativeIncoming p').textContent.includes('Empfangsbestätigung'));
      await page.evaluate(() => fixture.events.forEach(cb=>cb()));
      assert.equal(await page.evaluate(() => fixture.changes),1);assert.equal(await page.locator('#nativeIncoming button').first().isVisible(),false);await page.close();
    });
    await t.test('nonfinal empty chunk fails closed; Arabic reception panel fits narrow view', async () => {
      const page=await pageFor('zero');await page.locator('#nativeIncoming button').first().click();
      await page.waitForFunction(() => document.querySelector('#nativeIncoming p').textContent.includes('nicht vollständig'));
      assert.equal(await page.evaluate(() => fixture.changes),0);
      await page.locator('#nativeIncoming button').nth(1).click();
      await page.evaluate(() => { document.documentElement.lang='ar';document.documentElement.dir='rtl';fixture.queue.push({id:'arabic',files:[{id:'first',name:'مستند.pdf'}]});WFPNativeIncoming.show(); });
      await page.waitForFunction(() => document.querySelector('#nativeIncoming')?.textContent.includes('تم استلام'));
      assert.equal(await page.evaluate(() => document.querySelector('#nativeIncoming').getBoundingClientRect().right <= innerWidth),true);await page.close();
    });
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
});
