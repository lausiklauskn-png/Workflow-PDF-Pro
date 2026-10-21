import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { root } from './prepare-web.mjs';

test('folder input adapter: unchanged core, nested Unicode paths, abort and inaccessible files', async t => {
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{
    try{
      const path=resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
      if(path!==base&&!path.startsWith(base+'/'))throw Error();
      const file=path===base?join(path,'index.html'):path;
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');
      res.end(await readFile(file));
    }catch{res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
    const page=await browser.newPage();
    await page.addInitScript(()=>{
      window.__importFixture={mode:'ok',files:[],calls:[],data:{}};
      const api={
        async chooseFolder(){__importFixture.calls.push('choose');return __importFixture.mode==='cancel'?{cancelled:true}:{files:__importFixture.files};},
        async read({id,offset}){
          __importFixture.calls.push(['read',id,offset]);
          if(__importFixture.mode==='fail'&&id==='second')throw Error('permission revoked');
          if(__importFixture.mode==='abort')document.querySelector('#nativeImportStatus button').click();
          if(__importFixture.mode==='empty-chunk')return {data:'',done:false};
          const bytes=__importFixture.data[id].slice(offset,offset+262144);
          let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
          return {data:btoa(binary),done:offset+bytes.length>=__importFixture.data[id].length};
        },
        async release(){__importFixture.calls.push('release');}
      };
      const files={};for(const name of ['begin','append','finish','abort','save','share','print','openLink'])files[name]=async()=>({});
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowImport:api,WorkflowFiles:files}};
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__wfpdf&&window.WFPNativeImport&&window.PDFLib);
    await page.evaluate(async()=>{
      const pdf=await PDFLib.PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
      __importFixture.data.first=bytes;__importFixture.data.second=bytes;
      __importFixture.files=[{id:'first',name:'Teil 2 — Мüller.pdf',path:'Briefe/Unterordner/Teil 2 — Мüller.pdf',mime:'application/pdf'},
        {id:'second',name:'Teil 10.pdf',path:'Briefe/Teil 10.pdf',mime:'application/pdf'}];
      window.__changes=0;document.getElementById('inOrdner').addEventListener('change',()=>__changes++);
    });
    await t.test('picker cancellation changes no library and dispatches no selection',async()=>{
      const result=await page.evaluate(async()=>{__importFixture.mode='cancel';await WFPNativeImport.choose(document.getElementById('inOrdner'));return {n:(await WFP.DB.all('docs')).length,changes:__changes,calls:__importFixture.calls};});
      assert.equal(result.n,0);assert.equal(result.changes,0);assert.deepEqual(result.calls,['choose','release']);
    });
    await t.test('failure in a later file never imports a silently truncated folder',async()=>{
      const result=await page.evaluate(async()=>{__importFixture.mode='fail';await WFPNativeImport.choose(document.getElementById('inOrdner'));return {n:(await WFP.DB.all('docs')).length,changes:__changes,error:document.getElementById('nativeImportStatus').getAttribute('role'),last:__importFixture.calls.at(-1)};});
      assert.deepEqual(result,{n:0,changes:0,error:'alert',last:'release'});
    });
    await t.test('abort during a read and an invalid empty chunk dispatch nothing',async()=>{
      for(const mode of ['abort','empty-chunk']){
        const result=await page.evaluate(async mode=>{document.getElementById('nativeImportStatus')?.remove();__importFixture.mode=mode;await WFPNativeImport.choose(document.getElementById('inOrdner'));return {n:(await WFP.DB.all('docs')).length,changes:__changes,last:__importFixture.calls.at(-1)};},mode);
        assert.deepEqual(result,{n:0,changes:0,last:'release'});
      }
    });
    await t.test('complete selection reaches original library with original PDF bytes and unchecked status',async()=>{
      await page.evaluate(()=>{document.getElementById('nativeImportStatus')?.remove();__importFixture.mode='ok';document.getElementById('inOrdner').click();});
      await page.waitForFunction(()=> window.__wfpdf.S.docs.length===2);
      const result=await page.evaluate(async()=>{
        const docs=await WFP.DB.all('docs'),folders=await WFP.DB.all('folders');
        return {changes:__changes,folder:folders.find(f=>f.name==='Briefe')?.name,names:docs.map(d=>d.name).sort(),unexamined:docs.every(d=>!d.pruefung),
          bytes:await Promise.all(docs.map(async d=>{const bytes=new Uint8Array(await WFP.DB.getFile(d.id));return bytes.length===__importFixture.data.first.length&&bytes.every((b,i)=>b===__importFixture.data.first[i]);}))};
      });
      assert.equal(result.changes,1);assert.equal(result.folder,'Briefe');assert.equal(result.unexamined,true);assert.ok(result.bytes.every(Boolean));
      assert.deepEqual(result.names,['Teil 10','Teil 2 — Мüller']);
    });
    await t.test('translation-folder input retains relative paths and multi-chunk bytes',async()=>{
      const result=await page.evaluate(async()=>{
        const input=document.getElementById('inUeOrdner');input.onchange=null;
        let captured;input.addEventListener('change',()=>{captured=[...input.files];},{once:true});
        __importFixture.data.first=Uint8Array.from({length:600001},(_,i)=>i%251);__importFixture.files=__importFixture.files.slice(0,1);__importFixture.calls=[];
        await WFPNativeImport.choose(input);const bytes=new Uint8Array(await captured[0].arrayBuffer());
        return {path:captured[0].webkitRelativePath,equal:bytes.every((b,i)=>b===i%251),size:bytes.length,offsets:__importFixture.calls.filter(c=>Array.isArray(c)).map(c=>c[2])};
      });
      assert.equal(result.path,'Briefe/Unterordner/Teil 2 — Мüller.pdf');assert.equal(result.size,600001);assert.equal(result.equal,true);assert.deepEqual(result.offsets,[0,262144,524288]);
    });
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
