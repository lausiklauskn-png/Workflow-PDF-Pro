#!/usr/bin/env python3
"""Install the actual release, create a folder through its visible WebView UI,
then reinstall the same signed APK and verify retained app data. No debug bridge.
"""
import hashlib,json,re,subprocess,sys,time
from pathlib import Path
import xml.etree.ElementTree as ET

apk=Path(sys.argv[1]).resolve()
development='--development-probe' in sys.argv[2:]
package='de.familyprojekt.workflowpdf.pro'+('.debug' if development else '')
marker='Release-Installationspruefung'
def adb(*args):
    return subprocess.run(['adb',*map(str,args)],check=True,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45).stdout
def hierarchy():
    adb('shell','uiautomator','dump','--compressed','/sdcard/workflow-release-probe.xml')
    return ET.fromstring(adb('exec-out','cat','/sdcard/workflow-release-probe.xml'))
def wait_node(predicate,seconds=45):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        try:
            root=hierarchy()
            for node in root.iter('node'):
                if predicate(node.attrib):return node.attrib
        except (ET.ParseError,subprocess.CalledProcessError):pass
        time.sleep(.5)
    raise RuntimeError('Expected release UI element not found')
def tap(node):
    bounds=list(map(int,re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node['bounds']).groups()))
    adb('shell','input','tap',(bounds[0]+bounds[2])//2,(bounds[1]+bounds[3])//2)
def launch():
    result=adb('shell','am','start','-W','-n',package+'/.MainActivity')
    if 'Status: ok' not in result:raise RuntimeError('Regular application did not launch')
    if not adb('shell','pidof',package).strip():raise RuntimeError('Regular process is missing')

digest=hashlib.sha256(apk.read_bytes()).hexdigest()
if development:
    import os
    receipt={'apkSha256':digest,'applicationId':package,'commit':os.environ['GITHUB_SHA'],'versionCode':1}
else:receipt=json.loads(Path(str(apk)+'.json').read_text())
assert receipt['apkSha256']==digest and receipt['applicationId']==package
adb('install','-r',apk);launch()
tap(wait_node(lambda node:node.get('text','').strip() in ['＋ Ordner','+ Ordner','＋ Folder','+ Folder']))
tap(wait_node(lambda node:node.get('class')=='android.widget.EditText'))
adb('shell','input','text',marker)
tap(wait_node(lambda node:node.get('text')=='OK'))
wait_node(lambda node:marker in node.get('text',''))
adb('shell','am','force-stop',package)
adb('install','-r',apk);launch()
wait_node(lambda node:marker in node.get('text',''))
proof={'applicationId':package,'apkSha256':digest,'commit':receipt['commit'],'versionCode':receipt['versionCode'],'api':int(adb('shell','getprop','ro.build.version.sdk').strip()),'firstInstall':True,'reinstallPreservesData':True,'developmentProbe':development,'probe':'visible WebView UI; folder retained across signed APK reinstall; no debug JS access'}
Path(str(apk)+'.installation.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
