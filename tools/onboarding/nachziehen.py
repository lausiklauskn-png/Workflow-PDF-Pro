"""Copy a committed canonical Workflow-PDF tree, preserving byte provenance.

Usage: python3 tools/onboarding/nachziehen.py /path/to/Workflow-PDF [commit]
Only previously inventoried upstream files may be replaced or removed. Changes
to the existing copy are rejected before any write; native adapters stay separate.
"""
from pathlib import Path
import hashlib, json, re, subprocess, sys

root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1]).resolve()
ref=sys.argv[2] if len(sys.argv)>2 else 'HEAD'
def git(*args):
    return subprocess.check_output(['git','-C',str(source),*args])
commit=git('rev-parse',ref+'^{commit}').decode().strip()
manifest_file=root/'docs/portierung/QUELLDATEIEN-SHA256.json'
old=json.loads(manifest_file.read_text())
target=root/'upstream/workflow-pdf'
old_names={r['path'] for r in old['files']}
for row in old['files']:
    p=target/row['path']
    if p.is_symlink() or not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']:
        raise SystemExit('Existing upstream copy differs: '+row['path'])
files=[]
for entry in git('ls-tree','-r','-z',commit).split(b'\0'):
    if not entry: continue
    meta,name=entry.split(b'\t',1);mode,kind,blob=meta.split()
    name=name.decode()
    if mode not in (b'100644',b'100755') or kind!=b'blob' or any(p in ('','.','..') for p in name.split('/')) or '\\' in name:
        raise SystemExit('Unsupported source entry: '+name)
    p=target/name
    if name not in old_names and p.exists():raise SystemExit('Uninventoried target exists: '+name)
    files.append((name,git('cat-file','blob',blob.decode()),int(mode,8)))
manifest=[];controls=[];functions=[]
for name,data,mode in files:
    p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(mode & 0o777)
    manifest.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    if p.suffix not in ('.js','.html') or name.startswith(('vendor/','tests/','tools/')):continue
    text=data.decode('utf8')
    for m in re.finditer(r'<(button|input|select|textarea|summary|a)\b([^>]*)(?:>([\s\S]*?)</\1>)?',text):
        controls.append({'source':name,'line':text.count('\n',0,m.start())+1,'tag':m.group(1),'attributes':m.group(2).strip(),
            'text':' '.join(re.sub('<[^>]+>',' ',m.group(3) or '').split()),'native_evidence':'offen'})
    for m in re.finditer(r'\b(?:async\s+)?function\s+([\w$]+)\s*\(([^)]*)\)',text):
        functions.append({'source':name,'line':text.count('\n',0,m.start())+1,'function':m.group(1),'parameters':m.group(2)})
for name in old_names-{name for name,_,_ in files}:(target/name).unlink()
for name,value in [('QUELLDATEIEN-SHA256.json',{'commit':commit,'files':manifest}),('BEDIENELEMENTE.json',controls),('FUNKTIONEN-QUELLINDEX.json',functions)]:
    (manifest_file.parent/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
print(f'{len(files)} canonical files copied byte-for-byte from {commit}')
