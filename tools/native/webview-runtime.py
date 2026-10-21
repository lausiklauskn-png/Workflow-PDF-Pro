#!/usr/bin/env python3
"""Use the unmodified WebView shipped by the official API-35 SDK image on the
API-31 emulator too. Android's normal package signature checks remain enabled.
This configures test emulators only; it is never bundled with the product APK.
"""
import hashlib,json,os,re,subprocess,sys,time
from pathlib import Path

def adb(*args):
    for attempt in range(4):
        result=subprocess.run(['adb',*args],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=90)
        if not result.returncode:return result.stdout
        if attempt<3:
            # The SDK image restarts adbd once after its first boot. Reconnect
            # and repeat the same signature-checked operation, never skip it.
            subprocess.run(['adb','wait-for-device'],timeout=45,check=True)
            time.sleep(2)
    raise RuntimeError((result.stdout+result.stderr)[-3000:])
def provider():
    state=adb('shell','dumpsys','webviewupdate')
    match=re.search(r'Current WebView package \(name, version\): \(([^,]+), ([^)]+)\)',state)
    if not match:raise RuntimeError('No current WebView provider: '+state[-3000:])
    return {'package':match[1],'version':match[2]}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

mode,folder=sys.argv[1:3]
directory=Path(folder);directory.mkdir(parents=True,exist_ok=True)
if mode=='collect':
    current=provider();assert int(current['version'].split('.')[0])>=120,current
    listed={match[2]:match[1] for line in adb('shell','pm','list','packages','-f','--match-libraries').splitlines() if (match:=re.match(r'^package:(.*\.apk)=([^=]+)$',line.strip()))}
    packages=set(listed)
    selected={name for name in packages if 'trichromelibrary' in name}|{current['package']}
    records=[]
    for package in sorted(selected,key=lambda p:('trichrome' not in p,p)):
        try:paths=[line.removeprefix('package:').strip() for line in adb('shell','pm','path',package).splitlines() if line.startswith('package:')]
        except RuntimeError:paths=[]
        if not paths and package in listed:paths=[listed[package]]
        if not paths:raise RuntimeError('SDK runtime package has no APK: '+package)
        files=[]
        for i,path in enumerate(paths):
            name=package+'-'+str(i)+'.apk';out=directory/name
            adb('pull',path,str(out));files.append({'name':name,'sha256':sha(out)})
        records.append({'package':package,'files':files})
    manifest={'commit':os.environ['GITHUB_SHA'],'sourceApi':int(adb('shell','getprop','ro.build.version.sdk').strip()),'provider':current,'packages':records}
    (directory/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
elif mode=='install':
    manifest=json.loads((directory/'manifest.json').read_text());assert manifest['commit']==os.environ['GITHUB_SHA'];assert manifest['sourceApi']==35
    for record in manifest['packages']:
        for file in record['files']:assert sha(directory/file['name'])==file['sha256']
    before=provider()
    if before!=manifest['provider']:
        for record in manifest['packages']:
            files=[str(directory/file['name']) for file in record['files']]
            adb(*(['install-multiple','-r'] if len(files)>1 else ['install','-r']),*files)
        print(adb('shell','cmd','webviewupdate','set-webview-implementation',manifest['provider']['package']))
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            if provider()==manifest['provider']:break
            time.sleep(.2)
    assert provider()==manifest['provider'],provider()
    print(json.dumps({'before':before,'after':provider(),'source':'official API-35 SDK image; unmodified APKs; regular signature-checked installation'}))
else:raise RuntimeError('Expected collect/install')
