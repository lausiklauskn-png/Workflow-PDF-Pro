/* Native export/share adapters; no modification of PDF output or source event handlers. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const api = Capacitor.Plugins.WorkflowFiles, blobs = new Map();
  if (typeof api?.begin !== 'function') throw new Error('WorkflowFiles native bridge unavailable');
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); blobs.set(url, blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); revoke(url); };
  const words = {
    back: ['Zurück', 'Back', 'Назад', 'رجوع'], print: ['Drucken', 'Print', 'Печать', 'طباعة'],
    save: ['Speichern unter …', 'Save as …', 'Сохранить как …', 'حفظ باسم …'],
    fail: ['Dateiaktion fehlgeschlagen. Es wurde kein Erfolg bestätigt.', 'File action failed. Success was not confirmed.', 'Ошибка операции с файлом. Успех не подтверждён.', 'فشلت عملية الملف. لم يتم تأكيد النجاح.'],
    saved: ['Datei gespeichert und geprüft.', 'File saved and verified.', 'Файл сохранён и проверен.', 'تم حفظ الملف والتحقق منه.']
  };
  const t = key => words[key][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(document.documentElement.lang))];
  function notify(text) {
    let line = document.getElementById('nativeFileStatus');
    if (!line) { line = document.createElement('p'); line.id = 'nativeFileStatus'; line.setAttribute('role', 'status'); document.body.append(line); }
    line.textContent = text; line.hidden = false;
    clearTimeout(notify.timer); notify.timer = setTimeout(() => { line.hidden = true; }, 8000);
  }
  const fail = () => notify(t('fail'));
  const encode = bytes => { let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text); };
  async function transfer(blob, name) {
    const { id } = await api.begin({ name: name || blob.name || 'Dokument.pdf', mime: blob.type || 'application/octet-stream' });
    try {
      for (let offset = 0; offset < blob.size; offset += 262144) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + 262144).arrayBuffer());
        await api.append({ id, offset, data: encode(bytes) });
      }
      await api.finish({ id, size: blob.size }); return id;
    } catch (error) { await api.abort({ id }).catch(() => {}); throw error; }
  }
  async function save(blob, name) {
    const id = await transfer(blob, name);
    try { const result = await api.save({ id }); if (result.saved) notify(t('saved')); return result; }
    finally { await api.abort({ id }).catch(() => {}); }
  }
  let sharing = false;
  const canShare = data => Boolean(data && (Array.isArray(data.files) ? data.files.length && data.files.every(file => file instanceof Blob) : data.url || data.text));
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
    if (!canShare(data)) throw new TypeError('Unsupported share data');
    if (sharing) throw new DOMException('Share already active', 'InvalidStateError');
    sharing = true; const ids = []; let opened = false;
    try {
      for (const file of data.files || []) ids.push(await transfer(file, file.name));
      const result = await api.share({ ids, title: data.title || '', text: data.text || '', url: data.url || '' });
      opened = result.opened === true;
    } finally {
      // A receiving app may read after the chooser returns. Keep shared tickets until cache cleanup.
      if (!opened) for (const id of ids) await api.abort({ id }).catch(() => {});
      sharing = false;
    }
  } });
  const nativeClick = HTMLAnchorElement.prototype.click;
  function download(anchor) {
    if (!anchor.hasAttribute('download')) return false;
    const blob = blobs.get(anchor.href);
    if (!blob) return false;
    void save(blob, anchor.download).catch(fail); return true;
  }
  HTMLAnchorElement.prototype.click = function () { if (!download(this)) return nativeClick.call(this); };
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a');
    if (anchor && download(anchor)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  let viewer = null;
  async function preview(blob) {
    viewer?.close();
    const name = (String(window.__wfpdf?.S.doc?.name || 'Dokument').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Dokument') + '.pdf';
    const panel = document.createElement('section'); panel.className = 'native-pdf-view';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    const row = document.createElement('nav'), pages = document.createElement('div');
    const button = (label, click) => { const b = document.createElement('button'); b.className = 'knopf'; b.textContent = label; b.onclick = click; row.append(b); return b; };
    let pdf, observer, closed = false;
    const close = () => { closed = true; observer?.disconnect(); void pdf?.destroy(); panel.remove(); if (viewer === panel) viewer = null; };
    panel.close = close; viewer = panel;
    button(t('back'), close);
    button(t('print'), () => { void transfer(blob, name).then(id => api.print({ id })).catch(fail); });
    button(t('save'), () => { void save(blob, name).catch(fail); });
    panel.append(row, pages); document.body.append(panel);
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      if (closed) { await pdf.destroy(); return; }
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          void (async () => {
            const page = await pdf.getPage(Number(entry.target.dataset.page)); if (closed) return;
            const viewport = page.getViewport({ scale: 1 });
            const scale = Math.min(2, devicePixelRatio || 1) * Math.min(1280, Math.max(280, pages.clientWidth - 24)) / viewport.width;
            const view = page.getViewport({ scale }); const canvas = entry.target;
            canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
          })().catch(() => { if (!closed) fail(); });
        }
      }, { root: pages, rootMargin: '400px' });
      for (let page = 1; page <= pdf.numPages; page++) {
        const canvas = document.createElement('canvas'); canvas.dataset.page = page;
        canvas.setAttribute('aria-label', String(page)); pages.append(canvas); observer.observe(canvas);
      }
    } catch { close(); fail(); }
  }
  const open = window.open.bind(window);
  window.open = (url, target, features) => {
    const blob = blobs.get(String(url));
    if (blob?.type === 'application/pdf') { void preview(blob); return { close: () => viewer?.close(), focus() {} }; }
    try {
      const link = new URL(url, location.href);
      if (['http:', 'https:', 'mailto:', 'tel:'].includes(link.protocol) && link.origin !== location.origin) {
        void api.openLink({ url: link.href }).catch(fail); return { close() {}, focus() {} };
      }
    } catch { /* Original behavior for URLs not handled by a native adapter. */ }
    return open(url, target, features);
  };
  window.WFPNativeNavigation = { back() {
    if (viewer) { viewer.close(); return true; }
    const dialogs = [...document.querySelectorAll('#modals .dlg-grund')];
    if (dialogs.length) {
      const top = dialogs.at(-1), cancel = top.querySelector('[data-n],[data-abbruch],[data-x],[data-zurueck]');
      if (cancel) cancel.click(); else top.click();
      return true;
    }
    if (document.getElementById('sc-ed')?.classList.contains('on')) { document.getElementById('edZurueck').click(); return true; }
    return false;
  } };
  window.WFPNativeFiles = Object.freeze({ save, transfer });
})();
