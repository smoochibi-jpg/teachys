(() => {
  const pending = new Map();
  let failureNoticeAt = 0;
  function notifyStorageFailure(error) {
    const now = Date.now();
    window.dispatchEvent(new CustomEvent('teachys:storage-write-failed', { detail: { error, pending } }));
    if (now - failureNoticeAt < 1800) return;
    failureNoticeAt = now;
    const message = 'Penyimpanan browser penuh atau tidak tersedia. Perubahan masih ditahan sementara; unduh cadangan sebelum menutup halaman.';
    if (typeof window.toast === 'function') { window.toast(message); return; }
    if (!document.body) { console.warn(message, error); return; }
    const notice = document.createElement('div');
    notice.className = 'toast';
    notice.textContent = message;
    document.body.append(notice);
    setTimeout(() => notice.remove(), 6000);
  }
  function safeSetItem(key, value) {
    const text = String(value);
    try {
      localStorage.setItem(key, text);
      pending.delete(key);
      window.dispatchEvent(new CustomEvent('teachys:local-write', { detail: { key } }));
      return true;
    } catch (error) {
      pending.set(key, text);
      notifyStorageFailure(error);
      return false;
    }
  }
  function safeRemoveItem(key) {
    try { localStorage.removeItem(key); pending.delete(key); window.dispatchEvent(new CustomEvent('teachys:local-write', { detail: { key, removed: true } })); return true; }
    catch (error) { notifyStorageFailure(error); return false; }
  }
  async function persist() {
    try {
      if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch { /* Browser may decline persistent storage. */ }
    return false;
  }
  async function estimate() {
    try { return navigator.storage?.estimate ? await navigator.storage.estimate() : null; }
    catch { return null; }
  }
  window.teachysStorage = { setItem: safeSetItem, removeItem: safeRemoveItem, pending, persist, estimate };
  window.safeTeachysSetItem = safeSetItem;
  window.teachysStorage.persist();
})();
