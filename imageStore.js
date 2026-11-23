/* Penyimpanan media terpusat. Saat Supabase Storage dipakai nanti, cukup ganti modul ini. */
(() => {
  const DB_NAME = 'teachys-image-store';
  const STORE = 'images';
  const VERSION = 1;
  const urls = new Map();
  let databasePromise;

  function openDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Penyimpanan berkas tidak tersedia di browser ini.'));
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Penyimpanan berkas gagal dibuka.'));
      request.onblocked = () => reject(new Error('Tutup tab Teachy’s lain, lalu coba lagi.'));
    });
    return databasePromise;
  }

  function validateImage(file) {
    if (!file) throw new Error('Pilih file terlebih dahulu.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Gunakan foto JPG, PNG, atau WebP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5 MB.');
  }

  async function decodeImage(file) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
      catch { return createImageBitmap(file); }
    }
    return new Promise((resolve, reject) => {
      const temporaryUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(temporaryUrl); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(temporaryUrl); reject(new Error('Foto tidak bisa dibaca. Coba pilih file lain.')); };
      image.src = temporaryUrl;
    });
  }

  async function compressImage(file) {
    validateImage(file);
    const image = await decodeImage(file);
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Foto belum bisa diproses. Silakan coba lagi.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();
    const toBlob = type => new Promise(resolve => canvas.toBlob(resolve, type, 0.8));
    const webp = await toBlob('image/webp');
    if (webp?.type === 'image/webp') return webp;
    const jpeg = await toBlob('image/jpeg');
    if (jpeg) return jpeg;
    throw new Error('Foto belum bisa diproses. Silakan coba lagi.');
  }

  async function writeRecord(key, blob, name, type, syncCloud = true) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put({ key, blob, name: name || key, type: type || blob.type || 'application/octet-stream', updatedAt: Date.now() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(new Error('Berkas gagal disimpan. Ruang penyimpanan browser mungkin penuh.'));
      transaction.onabort = () => reject(new Error('Berkas gagal disimpan. Coba lagi.'));
    });
    if (syncCloud && window.teachysCloud?.ready) {
      try { await window.teachysCloud.uploadFile(key, blob, name || key, type || blob.type); }
      catch (error) {
        console.warn('Berkas tersimpan di perangkat; sinkronisasi cloud akan dicoba lagi.', error.message);
        if (typeof window.toast === 'function') window.toast('Berkas disimpan di perangkat. Sinkronisasi cloud akan dicoba lagi saat jaringan tersedia.');
      }
    }
  }

  async function simpanGambar(key, file) {
    const blob = await compressImage(file);
    await writeRecord(key, blob, file.name, blob.type);
    return ambilFile(key);
  }

  async function simpanFile(key, file) {
    if (!file) throw new Error('Pilih lampiran terlebih dahulu.');
    if (file.type.startsWith('image/')) {
      const blob = await compressImage(file);
      await writeRecord(key, blob, file.name || key, blob.type);
    } else {
      await writeRecord(key, file.slice(0, file.size, file.type), file.name || key, file.type);
    }
    return key;
  }

  async function ambilRecord(key) {
    const db = await openDatabase();
    const local = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Berkas tersimpan tidak bisa dibuka.'));
    });
    if (local || !window.teachysCloud?.ready) return local;
    const remote = await window.teachysCloud.downloadFile(key);
    if (!remote?.blob) return null;
    await writeRecord(key, remote.blob, remote.name, remote.type, false);
    return { key, blob: remote.blob, name: remote.name, type: remote.type, updatedAt: Date.now() };
  }

  async function ambilFile(key) {
    const record = await ambilRecord(key);
    if (urls.has(key)) URL.revokeObjectURL(urls.get(key));
    if (!record?.blob) { urls.delete(key); return null; }
    const url = URL.createObjectURL(record.blob);
    urls.set(key, url);
    return url;
  }

  async function hapusFile(key) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(new Error('Berkas gagal dihapus. Coba lagi.'));
    });
    if (urls.has(key)) URL.revokeObjectURL(urls.get(key));
    urls.delete(key);
    try { await window.teachysCloud?.removeFile(key); } catch (error) { console.warn('Berkas cloud belum terhapus.', error.message); }
  }

  async function daftarFile(includeBackups = false) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).filter(item => includeBackups || !item.key.startsWith('backup:')));
      request.onerror = () => reject(new Error('Daftar berkas tersimpan gagal dibaca.'));
    });
  }

  async function pulihkanFile(record) {
    if (!record?.key || !(record.blob instanceof Blob)) throw new Error('Ada berkas cadangan yang tidak bisa dibaca.');
    await writeRecord(record.key, record.blob, record.name, record.type);
  }

  async function muatAset(root = document) {
    const elements = [...root.querySelectorAll('[data-storage-key]')];
    await Promise.all(elements.map(async element => {
      try {
        const record = await ambilRecord(element.dataset.storageKey);
        if (!record?.blob) return;
        if (urls.has(element.dataset.storageKey)) URL.revokeObjectURL(urls.get(element.dataset.storageKey));
        const url = URL.createObjectURL(record.blob);
        urls.set(element.dataset.storageKey, url);
        if (element instanceof HTMLImageElement) element.src = url;
        else { element.href = url; element.download = record.name || element.textContent.trim() || 'Lampiran'; }
      } catch (error) { console.warn('Lampiran belum dapat dibuka.', error); }
    }));
  }

  async function simpanCadanganMigrasi(blob) {
    const existing = await ambilRecord('backup:sebelum-migrasi');
    if (existing) return false;
    await writeRecord('backup:sebelum-migrasi', blob, 'cadangan-sebelum-migrasi.json', 'application/json');
    return true;
  }

  async function unduhCadanganMigrasi() {
    const record = await ambilRecord('backup:sebelum-migrasi');
    if (!record?.blob) return null;
    return URL.createObjectURL(record.blob);
  }

  async function clearLocalFiles() {
    const db = await openDatabase();
    const records = await daftarFile(true);
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const objectStore = transaction.objectStore(STORE);
      records.filter(record => !record.key.startsWith('backup:')).forEach(record => objectStore.delete(record.key));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(new Error('Cache berkas lama belum dapat dibersihkan.'));
    });
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.clear();
  }

  async function syncCloudFiles() {
    if (!window.teachysCloud?.ready) return;
    for (const record of await daftarFile(false)) {
      try { await window.teachysCloud.uploadFile(record.key, record.blob, record.name, record.type); }
      catch (error) { console.warn('Sebagian berkas masih menunggu sinkronisasi.', error.message); }
    }
  }

  window.addEventListener('teachys:cloud-ready', event => {
    if (event.detail?.previousUser && event.detail.previousUser !== event.detail.user?.id) {
      event.detail.waitUntil(clearLocalFiles().catch(error => console.warn(error.message)));
    } else syncCloudFiles();
  });
  window.addEventListener('online', syncCloudFiles);

  window.imageStore = {
    simpanGambar,
    ambilGambar: ambilFile,
    hapusGambar: hapusFile,
    simpanFile,
    ambilFile,
    hapusFile,
    daftarFile,
    pulihkanFile,
    muatAset,
    clearLocalFiles,
    simpanCadanganMigrasi,
    unduhCadanganMigrasi
  };
})();

