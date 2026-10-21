import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

test('native recognition keeps original live bar, text deduplication and stop semantics',async()=>{
  const browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
  try{
    const page=await browser.newPage();await page.goto('about:blank');
    await page.setContent('<html lang="de"><head></head><body><div id="wrap"><textarea id="input"></textarea><button id="mic">🎤</button></div></body></html>');
    await page.evaluate(()=>{
      // about:blank is not a secure randomUUID origin in every Chromium version.
      if(!crypto.randomUUID)crypto.randomUUID=()=> '00000000-0000-4000-8000-000000000001';
      const f=window.speechFixture={starts:[],stops:[],listeners:[],texts:[],messages:[]};
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowSpeech:{
        addListener(name,fn){f.listeners.push(fn);return{remove(){}};},
        async start(options){f.starts.push(options);if(f.denied)throw Error('not-allowed');},
        async stop(options){f.stops.push(options);f.listeners.forEach(fn=>fn({id:options.id,kind:'end'}));}
      }}};
    });
    await page.addScriptTag({content:await readFile(new URL('../../upstream/workflow-pdf/assets/sprechen.js',import.meta.url),'utf8')});
    await page.addScriptTag({content:await readFile(new URL('../../native/native-speech.js',import.meta.url),'utf8')});
    await page.evaluate(()=>{window.voice=WFSprechen.anhaengen({knopf:document.getElementById('mic'),nach:document.getElementById('wrap'),feld:document.getElementById('input'),sprache:()=> 'ru-RU',text:(text,final)=>speechFixture.texts.push({text,final}),meldung:text=>speechFixture.messages.push(text)});});
    assert.match(await page.locator('#mic').getAttribute('title'),/Android/);await page.click('#mic');
    assert.equal(await page.locator('[data-wfs]').isVisible(),true);
    const id=await page.evaluate(()=>speechFixture.starts[0].id);assert.match(id,/^[a-f0-9-]{36}$/);
    await page.evaluate(id=>{for(const e of [{kind:'speechstart'},{kind:'result',text:'копировать',final:false},{kind:'result',text:'копировать копировать',final:false},{kind:'result',text:'копировать',final:true},{kind:'end'}])speechFixture.listeners.forEach(fn=>fn({id,...e}));},id);
    assert.deepEqual(await page.evaluate(()=>speechFixture.texts.at(-1)),{text:'копировать',final:true});assert.equal(await page.locator('[data-wfs]').isVisible(),false);
    await page.click('#mic');await page.click('.wfs-fertig');assert.equal(await page.locator('[data-wfs]').isVisible(),false);
    assert.equal(await page.evaluate(()=>speechFixture.stops.at(-1).abort),false);
    await page.evaluate(()=>speechFixture.denied=true);await page.click('#mic');await page.waitForFunction(()=>speechFixture.messages.length>0);
    assert.equal(await page.locator('[data-wfs]').isVisible(),false);assert.match(await page.evaluate(()=>speechFixture.messages.at(-1)),/nicht erlaubt/);
    await page.close();
  }finally{await browser.close();}
});
