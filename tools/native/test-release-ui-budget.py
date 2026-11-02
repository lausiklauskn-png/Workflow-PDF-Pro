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
