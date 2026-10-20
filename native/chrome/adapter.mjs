// Narrow engine adapter. Installation in an Android WebView is intentionally
// separate: its native bridge and browser launching still need device validation.
export function chromeTranslator(bridge, von, nach) {
  let session, stopped = false;
  const stat = { zeichen: 0, anfragen: 0, ohne: 0, modell: 'Chrome (Google)' };
  const fn = async texte => {
    if (stopped) throw new Error('Angehalten');
    if (!session) session = Promise.resolve().then(() => bridge.open({ von, nach }));
    const host = await session;
    if (stopped) { await host.close(); throw new Error('Angehalten'); }
    const result = await host.translate(texte);
    if (stopped) throw new Error('Angehalten');
    if (!Array.isArray(result.texte) || result.texte.length !== texte.length || !result.texte.every(t => typeof t === 'string')) throw new Error('Ungültige Chrome-Antwort');
    Object.assign(stat, result.stat);
    return result.texte;
  };
  const end = notify => {
    if (stopped) return;
    stopped = true;
    if (session) session.then(host => host.close()).catch(() => {});
    if (notify && fn.beimHalt) fn.beimHalt();
  };
  fn.stat = stat; fn.art = 'chrome';
  fn.halt = () => end(true);
  fn.zu = () => end(false);
  return fn;
}
