/* Portable Workflow record envelope. PDF bytes stay binary; no base64-sized
   whole-document JSON. This layer does not change the existing backup format. */
((g) => {
  'use strict';
  const utf8 = new TextEncoder(), text = new TextDecoder('utf-8', { fatal: true });
  const magic = utf8.encode('WFPKV1\n');
  const types = {};
  for (const name of ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
    'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array']) if (typeof g[name] === 'function') types[name] = g[name];
  const endian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 'little' : 'big';
  const bad = () => { throw new Error('VAULT_RECORD_DAMAGED'); };
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  function encode(value) {
    const nodes = [], blocks = [], known = new WeakMap();
    function atom(v) {
      if (v === undefined) return { u: true };
      if (typeof v === 'bigint') return { bi: String(v) };
      if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0))) return { n: Object.is(v, -0) ? '-0' : String(v) };
      if (v === null || ['boolean', 'string', 'number'].includes(typeof v)) return v;
      if (typeof v !== 'object') throw new Error('VAULT_RECORD_UNSUPPORTED');
      if (known.has(v)) return { r: known.get(v) };
      const id = nodes.length; known.set(v, id); nodes.push(null);
      const entries = o => Object.keys(o).map(key => [key, atom(o[key])]);
      let node;
      if (v instanceof ArrayBuffer) { node = { t: 'buffer', size: v.byteLength }; blocks.push({ id, blob: new Blob([v]) }); }
      else if (ArrayBuffer.isView(v)) {
        if (v instanceof DataView) node = { t: 'view', buffer: atom(v.buffer), offset: v.byteOffset, size: v.byteLength };
        else if (Object.hasOwn(types, v.constructor.name)) node = { t: 'typed', kind: v.constructor.name, buffer: atom(v.buffer), offset: v.byteOffset, length: v.length, endian };
        else throw new Error('VAULT_RECORD_UNSUPPORTED');
      } else if (v instanceof Blob) {
        const file = typeof File === 'function' && v instanceof File;
        node = { t: file ? 'file' : 'blob', size: v.size, mime: v.type, ...(file ? { name: v.name, lastModified: v.lastModified } : {}) };
        blocks.push({ id, blob: v });
      } else if (Array.isArray(v)) node = { t: 'array', length: v.length, entries: entries(v) };
      else if (v instanceof Date) node = { t: 'date', time: Number.isNaN(v.getTime()) ? null : v.getTime() };
      else if (v instanceof RegExp) node = { t: 'regexp', source: v.source, flags: v.flags };
      else if (v instanceof Map) node = { t: 'map', entries: [...v].map(([key, item]) => [atom(key), atom(item)]) };
      else if (v instanceof Set) node = { t: 'set', values: [...v].map(atom) };
      else if (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null) node = { t: 'object', entries: entries(v) };
      else throw new Error('VAULT_RECORD_UNSUPPORTED');
      nodes[id] = node; return { r: id };
    }
    const root = atom(value), header = utf8.encode(JSON.stringify({ format: 'workflow-record', v: 1, root, nodes, blocks: blocks.map(b => b.id) }));
    if (header.length > 0xffffffff) throw new Error('VAULT_RECORD_UNSUPPORTED');
    const length = new Uint8Array(4); new DataView(length.buffer).setUint32(0, header.length);
    return new Blob([magic, length, header, ...blocks.map(b => b.blob)], { type: 'application/x-workflow-record' });
  }
  async function decode(blob) {
    if (!(blob instanceof Blob) || blob.size < magic.length + 4) bad();
    const prefix = new Uint8Array(await blob.slice(0, magic.length + 4).arrayBuffer());
    if (!magic.every((byte, i) => prefix[i] === byte)) bad();
    const length = new DataView(prefix.buffer).getUint32(magic.length);
    let offset = magic.length + 4 + length;
    if (offset > blob.size) bad();
    let header;
    try { header = JSON.parse(text.decode(await blob.slice(magic.length + 4, offset).arrayBuffer())); } catch { bad(); }
    if (header?.format !== 'workflow-record' || header.v !== 1 || !Array.isArray(header.nodes) || !Array.isArray(header.blocks)) bad();
    const nodes = header.nodes, values = new Array(nodes.length), loaded = new Set();
    function atom(v) {
      if (v === null || ['boolean', 'string', 'number'].includes(typeof v)) return v;
      if (!v || typeof v !== 'object' || Array.isArray(v)) bad();
      if (Object.hasOwn(v, 'r')) { if (!integer(v.r) || v.r >= values.length || values[v.r] === undefined) bad(); return values[v.r]; }
      if (v.u === true) return undefined;
      if (typeof v.bi === 'string' && /^-?\d+$/.test(v.bi)) return BigInt(v.bi);
      if (v.n === 'NaN') return NaN; if (v.n === 'Infinity') return Infinity; if (v.n === '-Infinity') return -Infinity; if (v.n === '-0') return -0;
      bad();
    }
    for (const id of header.blocks) {
      if (!integer(id) || id >= nodes.length || loaded.has(id)) bad();
      const node = nodes[id];
      if (!node || !['buffer', 'blob', 'file'].includes(node.t) || !integer(node.size) || offset + node.size > blob.size) bad();
      const part = blob.slice(offset, offset + node.size); offset += node.size; loaded.add(id);
      if (node.t === 'buffer') values[id] = await part.arrayBuffer();
      else if (node.t === 'file') values[id] = new File([part], node.name, { type: node.mime, lastModified: node.lastModified });
      else values[id] = new Blob([part], { type: node.mime });
    }
    if (offset !== blob.size) bad();
    for (let id = 0; id < nodes.length; id++) {
      const n = nodes[id]; if (!n || typeof n.t !== 'string') bad();
      if (loaded.has(id)) continue;
      if (n.t === 'array') { if (!integer(n.length) || n.length > 0xffffffff) bad(); values[id] = new Array(n.length); }
      else if (n.t === 'object') values[id] = {};
      else if (n.t === 'map') values[id] = new Map();
      else if (n.t === 'set') values[id] = new Set();
      else if (n.t === 'date') values[id] = new Date(n.time === null ? NaN : n.time);
      else if (n.t === 'regexp') values[id] = new RegExp(n.source, n.flags);
      else if (!['typed', 'view'].includes(n.t)) bad();
    }
    for (let id = 0; id < nodes.length; id++) {
      const n = nodes[id]; if (!['typed', 'view'].includes(n.t)) continue;
      const buffer = atom(n.buffer); if (!(buffer instanceof ArrayBuffer) || !integer(n.offset)) bad();
      if (n.t === 'view') { if (!integer(n.size)) bad(); values[id] = new DataView(buffer, n.offset, n.size); }
      else {
        if (!Object.hasOwn(types, n.kind) || !integer(n.length) || n.endian !== endian) bad();
        values[id] = new types[n.kind](buffer, n.offset, n.length);
      }
    }
    for (let id = 0; id < nodes.length; id++) {
      const n = nodes[id], value = values[id];
      if (n.t === 'object' || n.t === 'array') {
        if (!Array.isArray(n.entries)) bad();
        for (const entry of n.entries) {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || entry[0] === 'length' && n.t === 'array') bad();
          Object.defineProperty(value, entry[0], { value: atom(entry[1]), writable: true, enumerable: true, configurable: true });
        }
      } else if (n.t === 'map') {
        if (!Array.isArray(n.entries)) bad(); for (const pair of n.entries) { if (!Array.isArray(pair) || pair.length !== 2) bad(); value.set(atom(pair[0]), atom(pair[1])); }
      } else if (n.t === 'set') { if (!Array.isArray(n.values)) bad(); for (const item of n.values) value.add(atom(item)); }
    }
    return atom(header.root);
  }
  g.WFPVaultCodec = Object.freeze({ encode, decode });
})(globalThis);
