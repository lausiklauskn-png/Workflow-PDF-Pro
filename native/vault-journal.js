/* Serial redo journal. Records.save is acknowledged only after native encrypted
   writing and read-back. The local commit must be one IndexedDB transaction.
   No passwords, API keys, localStorage or network identity enter this journal. */
((g) => {
  'use strict';
  const JOURNAL = 'workflow-library-journal-v1';
  const STORES = ['folders', 'docs', 'files', 'texte', 'vektoren'];
  const fail = code => { throw new Error(code); };
  class Journal {
    constructor({ bridge, records, local, location, vaultId, status = () => {} }) {
      Object.assign(this, { bridge, records, local, location, vaultId, status });
      this.tail = Promise.resolve(); this.blocked = true;
    }
    enqueue(work, recovery = false) {
      const result = this.tail.then(async () => {
        if (this.blocked && !recovery) fail('VAULT_RECOVERY_REQUIRED');
        try { return await work(); }
        catch (error) { this.blocked = true; this.status('error'); throw error; }
      });
      this.tail = result.catch(() => {});
      return result;
    }
    async check() {
      const state = await this.bridge.state({ location: this.location });
      if (state.id !== this.vaultId || state.location !== this.location || state.unlocked !== true || state.reachable !== true)
        fail(state.problem || 'VAULT_FOLDER_UNAVAILABLE');
    }
    validate(entry) {
      if (!entry || entry.id !== JOURNAL || entry.version !== 1 || entry.vaultId !== this.vaultId ||
          typeof entry.operation !== 'string' || !entry.operation || !Array.isArray(entry.changes) ||
          !['pending', 'done'].includes(entry.phase)) fail('VAULT_JOURNAL_DAMAGED');
      for (const change of entry.changes) {
        if (!change || !STORES.includes(change.store) || !['put', 'delete'].includes(change.kind) ||
            typeof change.id !== 'string' || !change.id || change.kind === 'put' && change.record?.id !== change.id)
          fail('VAULT_JOURNAL_DAMAGED');
      }
    }
    recover() {
      return this.enqueue(async () => {
        this.blocked = true; this.status('recovering'); await this.check();
        const info = await this.bridge.info({ location: this.location, store: 'settings', id: JOURNAL });
        if (info.exists === true) {
          const { record } = await this.records.load(this.location, 'settings', JOURNAL, info.hash);
          this.validate(record);
          if (record.phase === 'pending') await this.apply(record);
        } else if (info.exists !== false) fail('VAULT_JOURNAL_DAMAGED');
        this.blocked = false; this.status('saved');
      }, true);
    }
    write(changes) {
      // Clone at the call boundary, before another caller can mutate field values.
      const snapshot = structuredClone(changes);
      return this.mutate(() => snapshot);
    }
    mutate(build) {
      return this.enqueue(async () => {
        this.status('writing'); await this.check();
        const entry = { id: JOURNAL, version: 1, vaultId: this.vaultId,
          operation: g.crypto.randomUUID(), phase: 'pending', changes: await build() };
        this.validate(entry);
        await this.records.save(this.location, 'settings', entry);
        await this.apply(entry); this.status('saved');
      });
    }
    async apply(entry) {
      // Replaying after any interrupted step is idempotent. No local references
      // change until every remote record has been acknowledged.
      const local = [];
      for (const change of entry.changes) {
        if (change.kind === 'delete') {
          const result = await this.bridge.remove({ location: this.location, store: change.store, id: change.id });
          if (result.saved !== true) fail('VAULT_WRITE_UNCONFIRMED');
          local.push(change);
        } else {
          const info = await this.records.save(this.location, change.store, change.record);
          const record = change.store === 'files' ? { id: change.id, __wfpVault: {
            location: this.location, vaultId: this.vaultId, hash: info.hash
          } } : change.record;
          local.push({ kind: 'put', store: change.store, id: change.id, record });
        }
      }
      await this.local.commit(local);
      // Remove payload from the *current* journal only after the local transaction.
      // Older encrypted generations follow DocumentVault's existing retention.
      await this.records.save(this.location, 'settings', { ...entry, phase: 'done', changes: [] });
    }
    read(work) {
      return this.enqueue(async () => { await this.check(); return work(); });
    }
  }
  g.WFPVaultJournal = Journal;
})(globalThis);
