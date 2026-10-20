/* Binary record transport for the native vault. Loaded by the storage adapter,
   never by the unchanged web app. Passwords and keys stay in Android. */
((g) => {
  'use strict';
  const CHUNK = 262144;
  const problem = code => { throw new Error(code); };
  function base64(bytes) {
    let text = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(text);
  }
  function binary(value) {
    if (typeof value !== 'string' || value.length > 349528) problem('VAULT_INVALID_TRANSFER');
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
  }
  class Records {
    constructor(bridge) { this.bridge = bridge; }
    async save(location, store, record, reference) {
      if (!record || typeof record.id !== 'string' || !record.id) problem('VAULT_INVALID_RECORD');
      const blob = g.WFPVaultCodec.encode(record), id = record.id;
      const args = { location, store, id };
      if (reference !== undefined) args.reference = reference;
      const { ticket } = await this.bridge.begin(args);
      if (typeof ticket !== 'string' || !ticket) problem('VAULT_INVALID_TRANSFER');
      try {
        for (let offset = 0; offset < blob.size; offset += CHUNK) {
          const bytes = new Uint8Array(await blob.slice(offset, offset + CHUNK).arrayBuffer());
          await this.bridge.append({ location, ticket, offset, data: base64(bytes) });
        }
        const info = await this.bridge.finish({ location, ticket, store, id, size: blob.size });
        if (info.saved !== true || info.size !== blob.size || !/^[a-f0-9]{64}$/.test(info.hash)) problem('VAULT_WRITE_UNCONFIRMED');
        return info;
      } catch (error) {
        try { await this.bridge.abort({ location, ticket }); } catch { /* Keep the original failure. */ }
        throw error;
      }
    }
    async load(location, store, id, expectedHash) {
      const args = { location, store, id }, info = await this.bridge.info(args);
      if (info.exists !== true) problem('VAULT_RECORD_NOT_FOUND');
      if (!Number.isSafeInteger(info.size) || info.size < 0 || !/^[a-f0-9]{64}$/.test(info.hash)) problem('VAULT_RECORD_DAMAGED');
      // A stale copy of a selected folder must not silently replace the version
      // referenced by the internal database. Reconnection is an explicit UI action.
      if (expectedHash !== undefined && info.hash !== expectedHash) problem('VAULT_RECORD_CHANGED');
      const parts = [];
      for (let offset = 0; offset < info.size;) {
        const part = binary((await this.bridge.read({ ...args, offset, hash: info.hash })).data);
        if (!part.length || part.length > CHUNK || offset + part.length > info.size) problem('VAULT_INVALID_TRANSFER');
        parts.push(part); offset += part.length;
      }
      const record = await g.WFPVaultCodec.decode(new Blob(parts));
      if (!record || record.id !== id) problem('VAULT_RECORD_DAMAGED');
      return { record, info };
    }
  }
  g.WFPVaultRecords = Records;
})(globalThis);
