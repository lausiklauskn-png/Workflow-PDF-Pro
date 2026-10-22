// Included ONLY in the messprobe bundle. DevTools Runtime.evaluate can bypass
// CSP's eval restriction, so run these checks as an ordinary packaged script.
window.__WFPCspProbe = (async () => {
  let evalBlocked = false;
  try { (0, eval)('window.__wfpUnsafeEval=1'); } catch { evalBlocked = true; }
  const script = document.createElement('script');
  script.textContent = 'window.__wfpUnsafeInline=1'; document.body.append(script);
  await new Promise(resolve => setTimeout(resolve, 100)); script.remove();
  return {evalBlocked, inlineBlocked: !window.__wfpUnsafeInline};
})();
