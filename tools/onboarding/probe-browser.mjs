import {chromium} from '/workspace/setup/workflow-pdf-baseline/node_modules/playwright-core/index.mjs';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root='/workspace/setup/workflow-pdf-baseline';
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const f=path.join(root,name==='/'?'index.html':name);if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm'};res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});
try {const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.WFP?.Uebersetzung&&document.querySelector('#dokGitter').textContent.includes('Noch keine Dokumente'));
console.log(JSON.stringify(await page.evaluate(async()=>{const result={userAgent:navigator.userAgent,secure:isSecureContext,translator:typeof Translator,speechRecognition:typeof (window.SpeechRecognition||window.webkitSpeechRecognition),share:typeof navigator.share,canShare:typeof navigator.canShare,serviceWorker:!!navigator.serviceWorker,indexedDB:!!indexedDB,pairs:{}};for(const [a,b] of [['de','ru'],['ru','de'],['de','en'],['en','de'],['ru','en'],['en','ru']])result.pairs[a+'-'+b]=await WFP.Uebersetzung.browserVerfuegbar(a,b);return result;}),null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));}
