from pathlib import Path
import re,json,hashlib,subprocess
src=Path('/workspace/Workflow-PDF'); out=Path('/workspace/Workflow-PDF-Pro/docs/portierung')
files=subprocess.check_output(['git','-C',str(src),'ls-files','-z']).decode().split('\0')
manifest=[]; controls=[]; functions=[]
for name in filter(None,files):
 p=src/name
 if not p.is_file(): continue
 data=p.read_bytes();manifest.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 if p.suffix not in ['.js','.html']:continue
 if name.startswith(('vendor/','tests/','tools/')): continue
 text=data.decode('utf8')
 for m in re.finditer(r'<(button|input|select|textarea|summary|a)\b([^>]*)(?:>([\s\S]*?)</\1>)?',text):
  line=text.count('\n',0,m.start())+1
  label=re.sub('<[^>]+>',' ',m.group(3) or '')
  controls.append({'source':name,'line':line,'tag':m.group(1),'attributes':m.group(2).strip(),'text':' '.join(label.split()),'native_evidence':'offen'})
 for m in re.finditer(r'\b(?:async\s+)?function\s+([\w$]+)\s*\(([^)]*)\)',text):
  functions.append({'source':name,'line':text.count('\n',0,m.start())+1,'function':m.group(1),'parameters':m.group(2)})
(out/'QUELLDATEIEN-SHA256.json').write_text(json.dumps({'commit':subprocess.check_output(['git','-C',str(src),'rev-parse','HEAD']).decode().strip(),'files':manifest},ensure_ascii=False,indent=2)+'\n')
(out/'BEDIENELEMENTE.json').write_text(json.dumps(controls,ensure_ascii=False,indent=2)+'\n')
(out/'FUNKTIONEN-QUELLINDEX.json').write_text(json.dumps(functions,ensure_ascii=False,indent=2)+'\n')
print(len(manifest),'Dateien,',len(controls),'HTML-Bedienelement-Vorkommen,',len(functions),'benannte Funktionen')
