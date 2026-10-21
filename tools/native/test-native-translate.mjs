import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

test('native model capability retains original pair selection, retries, splitting and close',async()=>{
  const browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
  try{
    const page=await browser.newPage();await page.setContent('<html lang="de"><head></head><body></body></html>');
    await page.evaluate(()=>{
      const f=window.localFixture={created:[],closed:[],requests:[],mode:'ok'};
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowTranslate:{
        async availability({from,to}){return{status:['de','en','ru'].includes(from)&&['de','en','ru'].includes(to)&&from!==to?'downloadable':'unavailable'};},
        async create(options){const id='local-'+(f.created.length+1);f.created.push({id,...options});return{id};},
        async translate({id,text}){f.requests.push({id,text});if(f.mode==='once'){f.mode='ok';throw Error('LOCAL_TRANSLATION_FAILED');}if(f.mode==='wait')await new Promise(r=>f.release=r);return{text:'translated '+text};},
        async destroy({id}){f.closed.push(id);}
      }}};
    });
    await page.addScriptTag({content:await readFile(new URL('../../upstream/workflow-pdf/assets/uebersetzung.js',import.meta.url),'utf8')});
    await page.addScriptTag({content:await readFile(new URL('../../native/native-translate.js',import.meta.url),'utf8')});
    const result=await page.evaluate(async()=>{
      const pairs=[];for(const from of ['de','en','ru'])for(const to of ['de','en','ru'])if(from!==to)pairs.push(await WFP.Uebersetzung.browserVerfuegbar(from,to));
      const progress=[];const fn=await WFP.Uebersetzung.browserUebersetzer('de','ru',n=>progress.push(n));localFixture.mode='once';const words=await fn(['Guten Morgen.']);
      const large=await fn(['Langer Satz. '.repeat(500)]);const stats={...fn.stat};fn.zu();return{pairs,progress,words,large:large[0],stats,requests:localFixture.requests,created:localFixture.created,closed:localFixture.closed};
    });
    assert.deepEqual(result.pairs,Array(6).fill('downloadable'));assert.deepEqual(result.progress,[0,1]);assert.deepEqual(result.words,['translated Guten Morgen.']);assert.equal(result.stats.neustarts,1);assert.equal(result.stats.zerlegt,1);assert.ok(result.requests.slice(2).every(r=>r.text.length<=600));assert.equal(result.created.length,2);assert.equal(result.closed.length,2);
    const late=await page.evaluate(async()=>{const fn=await WFP.Uebersetzung.browserUebersetzer('de','en');localFixture.mode='wait';const pending=fn(['close pending']).then(()=>false,error=>error.name==='AbortError');await new Promise(r=>setTimeout(r,0));fn.zu();localFixture.release();return{aborted:await pending,restarts:fn.stat.neustarts};});assert.deepEqual(late,{aborted:true,restarts:0});
    await page.close();
  }finally{await browser.close();}
});
