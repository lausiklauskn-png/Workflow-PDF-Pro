/* WFP.DB-compatible methods for a configured vault. Activation/migration is a
   separate operation; this factory never silently switches a user's storage. */
((g) => {
  'use strict';
  function create({ journal, local, records }) {
    const put = (store, record) => ({ kind: 'put', store, id: record.id, record });
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
        return store === 'files' ? Promise.all(list.map(materialize)) : list;
      }),
      keys: store => journal.read(() => local.keys(store)),
      get: (store, id) => journal.read(async () => {
        const record = await local.get(store, id);
        return store === 'files' ? materialize(record) : record;
      }),
      put(store, record) {
        const copy = structuredClone(record);
        return journal.mutate(() => [put(store, copy)]).then(() => copy.id);
      },
      del: (store, id) => journal.mutate(async () => [del(store, id), ...(store === 'files' ? [
        ...(!String(id).endsWith('~original') ? [del('files', id + '~original')] : []), ...await derived(id)
      ] : [])]),
      vektorenWeg: id => journal.mutate(() => vectors(id)),
      putFile(id, bytes) {
        const copy = structuredClone(bytes);
        return journal.mutate(async () => [put('files', { id, bytes: copy }), ...await derived(id)]);
      },
      async getFile(id) { return (await db.get('files', id))?.bytes ?? null; },
      persist: () => journal.read(() => local.persist())
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
