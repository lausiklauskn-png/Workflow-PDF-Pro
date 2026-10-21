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
# Keep the synthetic folder fully visible in a narrow phone's horizontal bar;
# accessibility may omit the clipped end of a long label despite valid storage.
marker='WF-Probe'
def adb(*args):
    result=subprocess.run(['adb',*map(str,args)],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45)
    if result.returncode:raise RuntimeError('ADB '+str(args[:3])+': '+(result.stdout+result.stderr)[-3000:])
    return result.stdout
def hierarchy():
    adb('shell','uiautomator','dump','--compressed','/sdcard/workflow-release-probe.xml')
    return ET.fromstring(adb('exec-out','cat','/sdcard/workflow-release-probe.xml'))
def wait_node(predicate,seconds=45):
    deadline=time.monotonic()+seconds;root=ET.Element('hierarchy')
    while time.monotonic()<deadline:
        try:
            root=hierarchy()
            for node in root.iter('node'):
                if predicate(node.attrib):return node.attrib
        except (ET.ParseError,subprocess.CalledProcessError):pass
        time.sleep(.5)
    visible=[node.get('text','') for node in root.iter('node') if node.get('text')]
    raise RuntimeError('Expected release UI element not found; visible emulator labels: '+repr(visible)[-3000:])
def tap(node):
    bounds=list(map(int,re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node['bounds']).groups()))
    adb('shell','input','tap',(bounds[0]+bounds[2])//2,(bounds[1]+bounds[3])//2)
def stable_tap(predicate):
    deadline=time.monotonic()+30;previous=None
    while time.monotonic()<deadline:
        node=wait_node(predicate,10)
        if node.get('bounds')==previous:
            tap(node);return
        previous=node.get('bounds')
    raise RuntimeError('Visible control did not settle before tapping')
def launch():
    result=adb('shell','am','start','-W','-n',package+'/de.familyprojekt.workflowpdf.pro.MainActivity')
    if 'Status: ok' not in result:raise RuntimeError('Regular application did not launch')
    if not adb('shell','pidof',package).strip():raise RuntimeError('Regular process is missing')

digest=hashlib.sha256(apk.read_bytes()).hexdigest()
if development:
    import os
    receipt={'apkSha256':digest,'applicationId':package,'commit':os.environ['GITHUB_SHA'],'versionCode':1}
else:receipt=json.loads(Path(str(apk)+'.json').read_text())
assert receipt['apkSha256']==digest and receipt['applicationId']==package
existing=adb('shell','pm','list','packages',package).splitlines()
if 'package:'+package in existing:
    if not development:raise RuntimeError('First-install probe requires a clean dedicated emulator; existing production data is retained')
    # Remove only this emulator's synthetic debug-suite data. Never remove a
    # production installation, and retain all data for the following reinstall.
    adb('uninstall',package)
adb('install','-r',apk);launch()
folder_button=lambda node:node.get('text','').strip() in ['＋ Ordner','+ Ordner','＋ Folder','+ Folder']
for attempt in range(3):
    stable_tap(folder_button)
    try:
        # The phone header finishes its identity/status layout after startup.
        # Require the actual dialog, never type into the library search field.
        wait_node(lambda node:node.get('text') in ['Neuer Ordner','New folder'],5)
        break
    except RuntimeError:
        if attempt==2:
            # Exercise the ordinary keyboard path too. Some old WebView builds
            # report stale touch bounds with Android 15 edge-to-edge windows.
            # This uses visible focus and Enter, never JS/debug access or DB IO.
            for key in range(40):
                adb('shell','input','keyevent','KEYCODE_TAB')
                if any(folder_button(n.attrib) and n.get('focused')=='true' for n in hierarchy().iter('node')):
                    adb('shell','input','keyevent','KEYCODE_ENTER')
                    break
            wait_node(lambda node:node.get('text') in ['Neuer Ordner','New folder'],10)
wait_node(lambda node:node.get('class')=='android.widget.EditText' and node.get('focused')=='true')
adb('shell','input','text',marker)
wait_node(lambda node:node.get('class')=='android.widget.EditText' and node.get('text')==marker)
stable_tap(lambda node:node.get('text')=='OK')
wait_node(lambda node:marker in node.get('text',''))
adb('shell','am','force-stop',package)
adb('install','-r',apk);launch()
wait_node(lambda node:marker in node.get('text',''))
proof={'applicationId':package,'apkSha256':digest,'commit':receipt['commit'],'versionCode':receipt['versionCode'],'api':int(adb('shell','getprop','ro.build.version.sdk').strip()),'firstInstall':True,'reinstallPreservesData':True,'developmentProbe':development,'probe':'visible WebView UI; folder retained across signed APK reinstall; no debug JS access'}
Path(str(apk)+'.installation.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
