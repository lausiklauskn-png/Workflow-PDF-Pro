// Host-neutral browser half of trial A. Uses the byte-identical original engine.
(async () => {
  'use strict';
  let key = location.hash.slice(1), engine, lastId = 0;
  history.replaceState(null, '', '/');
  const status = document.getElementById('status');
  const request = async (path, data) => {
    const response = await fetch(path, {
      method: data === undefined ? 'GET' : 'POST',
      cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: { Authorization: 'Bearer ' + key, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    if (!response.ok) throw new Error('Verbindung beendet (' + response.status + ').');
    return response.json();
  };
  try {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Diese Sitzung fehlt oder ist abgelaufen. In der App erneut starten.');
    for (;;) {
      const next = await request('/batch');
      if (next.waiting || next.id === lastId) {
        status.textContent = 'Warte auf die nächste Seite aus der App …';
        await new Promise(resolve => setTimeout(resolve, 400)); continue;
      }
      lastId = next.id;
      if (!engine) {
        engine = WFP.Uebersetzung.chromeUebersetzer(next.von, next.nach);
        engine.beimHalt = () => { request('/cancel', {}).catch(() => {}); };
      }
      status.textContent = 'In Chrome ⋮ → Übersetzen wählen. Die App wartet auf das Ergebnis.';
      try {
        const texte = await engine(next.texte);
        await request('/result', { id: next.id, texte, stat: engine.stat });
        // No document text remains on screen between pages or after completion.
        const list = document.querySelector('#wfp-chrome [data-liste]'); if (list) list.replaceChildren();
        status.textContent = 'Seite an die App zurückgegeben. Dort wird das PDF erstellt.';
      } catch (error) {
        await request('/result', { id: next.id, error: 'translation-failed' }).catch(() => {});
        throw error;
      }
    }
  } catch (error) {
    key = '';
    if (engine) { engine.beimHalt = null; engine.halt(); engine.zu(); }
    status.textContent = error.message + ' Bitte zur App wechseln.';
  }
})();
