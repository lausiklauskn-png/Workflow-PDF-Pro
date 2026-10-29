/* WFP.DB-compatible methods for a configured vault. Activation/migration is a
   separate operation; this factory never silently switches a user's storage. */
((g) => {
  'use strict';
  // sammeln (nur die App, Klaus 2026-10-29: „Ich muss es ja nicht verschlüsselt speichern, wenn ich innerhalb der App arbeite“):
  // der Arbeitsstand eines Dokuments ('docs', klein, nach jedem Klick vom Kern geschrieben) wird im Arbeitsspeicher gesammelt
  // und als EIN Journal-Eintrag geschrieben — nach ruheMs ohne neue Änderung, vor jedem anderen Schreiben und auf schreibeJetzt()
  // (Speichern, Dokument schließen, App in den Hintergrund). Lesen sieht den gesammelten Stand. Ohne sammeln: wie bisher sofort.
  function create({ journal, local, records, sammeln = null }) {
    const put = (store, record) => ({ kind: 'put', store, id: record.id, record });
    let offen = new Map(), uhr = null;
    const melden = (sammeln && sammeln.fehler) || (() => {});
    function schreibeJetzt() {
      clearTimeout(uhr); uhr = null;
      if (!offen.size) return Promise.resolve();
      const changes = [...offen.values()].map(r => put('docs', r)); offen = new Map();
      const r = journal.mutate(() => changes);
      r.catch(error => { try { melden(error); } catch { /* Fehler bleibt im Journal */ } });
      return r;
    }
    const vorher = () => { if (offen.size) void schreibeJetzt().catch(() => {}); };
    const mitOffen = (store, id, record) => store === 'docs' && offen.has(id) ? structuredClone(offen.get(id)) : record;
    const del = (store, id) => ({ kind: 'delete', store, id });
    async function materialize(record) {
      if (!record?.__wfpVault) return record;
      const ref = record.__wfpVault;
      if (ref.location !== journal.location || ref.vaultId !== journal.vaultId || !/^[a-f0-9]{64}$/.test(ref.hash))
        throw new Error('VAULT_REFERENCE_DAMAGED');
      return (await records.load(ref.location, 'files', record.id, ref.hash)).record;
    }
    async function vectors(id) {
      return (await local.keys('vektoren')).filter(key => key === id || String(key).startsWith(id + '#')).map(key => del('vektoren', key));
    }
    async function derived(id) { return [del('texte', id), ...await vectors(id)]; }
    const db = {
      all: store => journal.read(async () => {
        const list = await local.all(store);
        if (store === 'docs' && offen.size) {
          const ids = new Set(list.map(r => r.id));
          return [...list.map(r => mitOffen(store, r.id, r)), ...[...offen.values()].filter(r => !ids.has(r.id)).map(r => structuredClone(r))];
        }
        return store === 'files' ? Promise.all(list.map(materialize)) : list;
      }),
      keys: store => journal.read(async () => {
        const keys = await local.keys(store);
        return store === 'docs' && offen.size ? [...new Set([...keys, ...offen.keys()])] : keys;
      }),
      get: (store, id) => journal.read(async () => {
        const record = await local.get(store, id);
        if (store === 'docs' && offen.has(id)) return mitOffen(store, id, record);
        return store === 'files' ? materialize(record) : record;
      }),
      put(store, record) {
        const copy = structuredClone(record);
        if (sammeln && store === 'docs' && copy && typeof copy.id === 'string' && copy.id) {
          offen.set(copy.id, copy); clearTimeout(uhr);
          uhr = setTimeout(() => { void schreibeJetzt().catch(() => {}); }, sammeln.ruheMs || 10000);
          return Promise.resolve(copy.id);
        }
        vorher();
        return journal.mutate(() => [put(store, copy)]).then(() => copy.id);
      },
      del: (store, id) => { if (store === 'docs') { offen.delete(id); if (!offen.size) { clearTimeout(uhr); uhr = null; } } vorher(); return journal.mutate(async () => [del(store, id), ...(store === 'files' ? [
        ...(!String(id).endsWith('~original') ? [del('files', id + '~original')] : []), ...await derived(id)
      ] : [])]); },
      vektorenWeg: id => { vorher(); return journal.mutate(() => vectors(id)); },
      putFile(id, bytes) {
        const copy = structuredClone(bytes);
        vorher();
        return journal.mutate(async () => [put('files', { id, bytes: copy }), ...await derived(id)]);
      },
      async getFile(id) { return (await db.get('files', id))?.bytes ?? null; },
      persist: () => journal.read(() => local.persist()),
      schreibeJetzt,
      offen: () => offen.size
    };
    return Object.freeze(db);
  }
  // The original database is opened first, retaining its name, version and stores.
  // A single native-index transaction commits reference changes and invalidation.
  async function localIndex(db) {
    await db.keys('folders');
    const connection = await new Promise((resolve, reject) => {
      const request = indexedDB.open('WorkflohPDF1', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return { ...db, close: () => connection.close(), commit(changes) {
      return new Promise((resolve, reject) => {
        if (!changes.length) { resolve(); return; }
        const tx = connection.transaction([...new Set(changes.map(c => c.store))], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('VAULT_INDEX_ABORTED'));
        try {
          for (const change of changes) {
            const store = tx.objectStore(change.store);
            if (change.kind === 'delete') store.delete(change.id); else store.put(change.record);
          }
        } catch (error) { tx.abort(); reject(error); }
      });
    } };
  }
  g.WFPVaultDB = Object.freeze({ create, localIndex });
})(globalThis);
