"""The visible-install probe keeps its existing bounded observation budget.
Only its function is compiled; this test cannot install/uninstall an APK."""
import ast
from pathlib import Path
source=Path(__file__).with_name('verify-signed-install.py').read_text()
tree=ast.parse(source)
function=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='stable_tap')

def run(function,forever=False):
    class Clock:
        now=0
        def monotonic(self):return self.now
    clock=Clock();calls=[];taps=[]
    def observe(predicate,seconds):
        calls.append(seconds)
        if forever or len(calls)==1:
            clock.now+=seconds
            raise RuntimeError('fixture: accessibility tree not ready')
        clock.now+=1
        return {'bounds':'[10,10][80,80]'}
    scope={'time':clock,'wait_node':observe,'tap':taps.append}
    exec(compile(ast.Module(body=[function],type_ignores=[]),'<visible-probe-function>','exec'),scope)
    error=None
    try:scope['stable_tap'](lambda node:True)
    except RuntimeError as failure:error=failure
    return taps,error,clock.now

taps,error,elapsed=run(function)
assert len(taps)==1 and error is None and elapsed<30,'first short observation must not abandon the settling budget'
taps,error,elapsed=run(function,True)
assert not taps and error and elapsed==30,'a missing control must still fail within the unchanged budget'
# Counterprobe: restore the prior early exit; the same fixture must expose it.
bad=source.replace('            last_error=error\n            continue','            raise error')
mutant=next(node for node in ast.parse(bad).body if isinstance(node,ast.FunctionDef) and node.name=='stable_tap')
taps,error,elapsed=run(mutant)
assert not taps and error and elapsed==10,'counterprobe did not restore the former early-exit fault'
print('PASS visible-control readiness, fixed 30-second budget, and early-exit counterprobe')

# Exercise the whole CLI against Android's asynchronous start contract. These
# are mock-ADB control-flow checks, not installed-app or signing evidence.
import hashlib,json,os,subprocess,sys,tempfile
fake_adb=r'''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
p=Path(os.environ['WFP_PROBE_STATE'])
s=json.loads(p.read_text()) if p.exists() else {'installs':0,'running':False,'dialog':False,'text':'','folder':False}
a=sys.argv[1:]
def done(value='',code=0):
 p.write_text(json.dumps(s));print(value);raise SystemExit(code)
if a[:3]==['shell','pm','list']:done('')
if a[:1]==['install']:
 s.update(installs=s['installs']+1,running=False,dialog=False,text='',replacementPending=True);done('Success')
if a[:3]==['shell','am','wait-for-broadcast-idle']:
 if os.environ['WFP_PROBE_MODE']=='unconfirmed-barrier':done('Unknown command')
 s['replacementPending']=False;done('All broadcast queues are idle!')
if a[:3]==['shell','am','start']:
 s['launchKilled']=s['installs']==2 and s['replacementPending'];done('Status: ok')
if a[:3]==['shell','am','force-stop']:
 s['running']=False;done('')
if a[:2]==['shell','pidof']:done('1234' if s['running'] else '',0 if s['running'] else 1)
if a[:2]==['shell','uiautomator']:
 s['running']=not(s.get('launchKilled') or (os.environ['WFP_PROBE_MODE']=='stale-ui' and s['installs']==2));done('UI dumped')
if a[:2]==['exec-out','cat']:
 nodes='<node text="＋ Ordner" bounds="[0,0][100,50]"/>'
 if s['dialog']:nodes+='<node text="Neuer Ordner" bounds="[0,50][100,100]"/><node class="android.widget.EditText" focused="true" text="'+s['text']+'" bounds="[0,100][100,150]"/>'
 if s['folder']:nodes+='<node text="WF-Probe" bounds="[0,150][100,200]"/>'
 done('<hierarchy>'+nodes+'</hierarchy>')
if a[:3]==['shell','input','tap']:
 s['dialog']=True;done('')
if a[:3]==['shell','input','text']:
 s['text']=a[3];done('')
if a[:3]==['shell','input','keyevent'] and a[3]=='KEYCODE_ENTER':
 s.update(folder=True,dialog=False);done('')
if a[:3]==['shell','getprop','ro.build.version.sdk']:done('31')
done('')
'''

def cli_probe(script,mode):
 with tempfile.TemporaryDirectory(prefix='wfp-release-readiness-') as directory:
  root=Path(directory);binary=root/'adb';binary.write_text(fake_adb);binary.chmod(0o755)
  apk=root/'fixture.apk';apk.write_bytes(b'control-flow fixture, not an APK')
  Path(str(apk)+'.json').write_text(json.dumps({'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'applicationId':'de.familyprojekt.workflowpdf.pro','commit':'a'*40,'versionCode':12}))
  tool=root/'probe.py';tool.write_text(script)
  environment={**os.environ,'PATH':str(root)+os.pathsep+os.environ['PATH'],'WFP_PROBE_STATE':str(root/'state.json'),'WFP_PROBE_MODE':mode}
  result=subprocess.run([sys.executable,str(tool),str(apk)],cwd=root,env=environment,text=True,capture_output=True,timeout=15)
  return result,Path(str(apk)+'.installation.json').exists()

result,proof=cli_probe(source,'late-process')
assert result.returncode==0 and proof,'a system start report must be followed by the existing visible-readiness observation before the process check: '+result.stderr
result,proof=cli_probe(source,'stale-ui')
assert result.returncode!=0 and not proof,'a cached folder label without a running process must never produce an installation receipt'
# Remove only the post-reinstall process assertion. The same stale-UI case must
# expose a false receipt, proving the negative check can detect this regression.
mutant=source.replace('    assert_running()\n    proof=', '    # counterprobe: missing process guard\n    proof=')
assert mutant!=source,'post-reinstall process assertion anchor missing'
result,proof=cli_probe(mutant,'stale-ui')
assert result.returncode==0 and proof,'counterprobe did not expose the false receipt'
print('PASS mock-ADB late-process readiness, stale-UI rejection and missing-process counterprobe')

# The recorded Android 12 failure reports start success but a delayed package
# replacement force-stop removes the activity. Only the installation barrier
# prevents it; waiting for UI/PID afterwards cannot repair a removed activity.
mutant=source.replace("    settled=adb('shell','am','wait-for-broadcast-idle')", "    settled='All broadcast queues are idle!' # counterprobe: skip system barrier")
assert mutant!=source,'installation broadcast barrier anchor missing'
result,proof=cli_probe(mutant,'late-process')
assert result.returncode!=0 and not proof,'missing-barrier counterprobe must expose the replacement force-stop, never produce a receipt'
result,proof=cli_probe(source,'unconfirmed-barrier')
assert result.returncode!=0 and not proof and 'did not confirm' in result.stderr,'an unsupported or unconfirmed barrier must fail closed'
print('PASS mock-ADB replacement force-stop counterprobe and unconfirmed-barrier rejection')
