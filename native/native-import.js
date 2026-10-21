/* Read-only Android folder selection feeds the original file-input handlers. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const api = Capacitor.Plugins.WorkflowImport;
  if (!api) return; // Browser fixtures may exercise only the independent export bridge.
  const words = {
    reading: ['Ordner wird gelesen …', 'Reading folder …', 'Чтение папки …', 'جارٍ قراءة المجلد …'],
    cancel: ['Abbrechen', 'Cancel', 'Отмена', 'إلغاء'],
    failed: ['Ordner konnte nicht vollständig gelesen werden. Es wurde nichts zum Import übergeben.', 'The folder could not be read completely. Nothing was submitted for import.', 'Не удалось полностью прочитать папку. Ничего не передано для импорта.', 'تعذرت قراءة المجلد بالكامل. لم يُرسل أي ملف للاستيراد.'],
    empty: ['Der gewählte Ordner enthält keine Dateien.', 'The selected folder contains no files.', 'В выбранной папке нет файлов.', 'المجلد المحدد لا يحتوي على ملفات.']
  };
  const t = key => words[key][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(document.documentElement.lang))];
  let busy = false;
  async function choose(input) {
    if (busy) return;
    document.getElementById('nativeImportStatus')?.remove();
    busy = true; let panel, cancelled = false, dispatched = false;
    try {
      const result = await api.chooseFolder();
      if (result.cancelled) return;
      if (!Array.isArray(result.files)) throw new Error('IMPORT_INVALID_TRANSFER');
      panel = document.createElement('p'); panel.id = 'nativeImportStatus'; panel.setAttribute('role', 'status'); panel.dataset.keinUe = '';
      const line = document.createElement('span'), cancel = document.createElement('button'); cancel.className = 'knopf'; cancel.textContent = t('cancel');
      cancel.onclick = () => { cancelled = true; cancel.disabled = true; };
      panel.append(line, cancel); document.body.append(panel);
      const files = new DataTransfer();
      for (let i = 0; i < result.files.length; i++) {
        if (cancelled) return;
        const item = result.files[i], parts = []; let offset = 0;
        if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.path !== 'string') throw new Error('IMPORT_INVALID_TRANSFER');
        line.textContent = t('reading') + ' ' + (i + 1) + ' / ' + result.files.length;
        while (true) {
          const part = await api.read({ id: item.id, offset });
          if (cancelled) return;
          if (typeof part.data !== 'string' || part.data.length > 349528 || typeof part.done !== 'boolean') throw new Error('IMPORT_INVALID_TRANSFER');
          const bytes = Uint8Array.from(atob(part.data), char => char.charCodeAt(0));
          if (bytes.length > 262144 || !bytes.length && !part.done) throw new Error('IMPORT_INVALID_TRANSFER');
          parts.push(bytes); offset += bytes.length;
          if (part.done) break;
        }
        const file = new File(parts, item.name, { type: item.mime || '' });
        Object.defineProperty(file, 'webkitRelativePath', { value: item.path });
        files.items.add(file);
      }
      if (!files.files.length) { line.textContent = t('empty'); cancel.remove(); return; }
      // Only a complete folder reaches the unchanged application. Permission/read
      // errors cannot masquerade as a successful partial folder selection.
      input.files = files.files;
      dispatched = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      if (!cancelled && !dispatched) {
        panel?.remove(); panel = document.createElement('p'); panel.id = 'nativeImportStatus'; panel.setAttribute('role', 'alert'); panel.dataset.keinUe = '';
        panel.textContent = t('failed'); document.body.append(panel);
      }
    } finally {
      try { await api.release(); } catch { /* No library state is changed by cleanup. */ }
      if (cancelled || dispatched) panel?.remove();
      busy = false;
    }
  }
  const click = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type === 'file' && this.hasAttribute('webkitdirectory')) { void choose(this); return; }
    return click.call(this);
  };
  document.addEventListener('click', event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === 'file' && input.hasAttribute('webkitdirectory')) {
      event.preventDefault(); event.stopImmediatePropagation(); void choose(input);
    }
  }, true);
  window.WFPNativeImport = Object.freeze({ choose });
})();
