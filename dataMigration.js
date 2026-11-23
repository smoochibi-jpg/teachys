(() => {
  const FLAG = 'teachysAssetsMigrated';
  const RESULT = 'teachysMigrationResult';
  const isDataUrl = value => typeof value === 'string' && /^data:[^,]*;base64,/i.test(value);
  const fromDataUrl = async value => (await fetch(value)).blob();
  const readKey = key => { try { return JSON.parse(window.teachysStorage.pending.get(key) ?? localStorage.getItem(key) ?? 'null'); } catch { return null; } };
  const saveJSON = (key, value) => {
    const saved = window.safeTeachysSetItem(key, JSON.stringify(value));
    if (!saved) throw new Error('Ruang localStorage penuh. Data lama tetap disimpan; unduh cadangan, lalu coba migrasi lagi.');
  };
  const result = { migrated: 0, skipped: 0, errors: 0, completed: false, updatedAt: new Date().toISOString() };

  async function storeUrl(key, name, dataUrl) {
    if (!isDataUrl(dataUrl)) return false;
    const blob = await fromDataUrl(dataUrl);
    const file = new File([blob], name || 'lampiran', { type: blob.type || 'application/octet-stream' });
    await window.imageStore.simpanFile(key, file);
    result.migrated++;
    return true;
  }

  async function migrateJournal(data) {
    if (!data || typeof data !== 'object') return;
    for (const [date, entry] of Object.entries(data)) {
      for (const [index, photo] of (entry.photos || []).entries()) {
        const legacy = typeof photo.data === 'string' ? photo.data : photo.data?.data;
        if (photo.storageKey || !legacy) { if (photo.storageKey) result.skipped++; continue; }
        const key = `journal:${date}:photo:${index}`;
        if (await storeUrl(key, photo.name || 'Foto jurnal', legacy)) {
          delete photo.data;
          photo.storageKey = key;
        }
      }
      for (const activity of entry.activities || []) {
        for (const [index, attachment] of (activity.attachments || []).entries()) {
          const legacy = typeof attachment.data === 'string' ? attachment.data : attachment.data?.data;
          if (attachment.storageKey || !legacy) { if (attachment.storageKey) result.skipped++; continue; }
          const key = `journal:${date}:attachment:${activity.id || 'kegiatan'}:${index}`;
          if (await storeUrl(key, attachment.name || 'Lampiran jurnal', legacy)) {
            delete attachment.data;
            attachment.storageKey = key;
          }
        }
      }
    }
    saveJSON('teachysJournal', data);
  }

  async function migrateLearning(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item.fileKey || !item.fileData) { if (item.fileKey) result.skipped++; continue; }
      const key = `learning:${item.id || crypto.randomUUID()}`;
      if (await storeUrl(key, item.fileName || 'Lampiran pembelajaran', item.fileData)) {
        item.fileKey = key;
        delete item.fileData;
      }
    }
    saveJSON('teachysLearning', items);
  }

  async function migrateBooks(data) {
    if (!data || typeof data !== 'object') return;
    for (const [bookId, rows] of Object.entries(data)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (row.proofKey || !row.proofData) { if (row.proofKey) result.skipped++; continue; }
        const key = `books:${bookId}:${row.id || crypto.randomUUID()}:proof`;
        if (await storeUrl(key, row['Bukti Kunjungan'] || 'Bukti administrasi', row.proofData)) {
          row.proofKey = key;
          delete row.proofData;
        }
      }
    }
    saveJSON('teachysAdminBooks', data);
  }

  async function run() {
    if (localStorage.getItem(FLAG) === 'true') {
      try { Object.assign(result, JSON.parse(localStorage.getItem(RESULT) || '{}')); } catch { /* ignore invalid status */ }
      result.completed = true;
      window.dispatchEvent(new CustomEvent('teachys:assets-migrated', { detail: result }));
      return result;
    }
    const before = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith('teachys')) before[key] = localStorage.getItem(key);
    }
    for (const [key, value] of window.teachysStorage.pending) if (key.startsWith('teachys')) before[key] = value;
    const backup = new Blob([JSON.stringify({ format: 'teachys-migration-backup-v1', createdAt: result.updatedAt, localStorage: before }, null, 2)], { type: 'application/json' });
    await window.imageStore.simpanCadanganMigrasi(backup);
    try {
      await migrateJournal(readKey('teachysJournal'));
      await migrateLearning(readKey('teachysLearning'));
      await migrateBooks(readKey('teachysAdminBooks'));
      if (!window.safeTeachysSetItem(FLAG, 'true')) throw new Error('Penanda migrasi belum tersimpan. Data yang sudah dipindah tetap aman; jalankan lagi setelah penyimpanan tersedia.');
      result.completed = true;
    } catch (error) {
      result.errors++;
      result.completed = false;
      result.message = error.message || 'Migrasi berhenti. Data lama tetap dipertahankan.';
    }
    result.updatedAt = new Date().toISOString();
    window.safeTeachysSetItem(RESULT, JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('teachys:assets-migrated', { detail: result }));
    return result;
  }

  window.teachysMigrationPromise = run().catch(error => {
    result.errors++;
    result.message = error.message || 'Cadangan sebelum migrasi gagal dibuat; data lama tidak diubah.';
    window.safeTeachysSetItem(RESULT, JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('teachys:assets-migrated', { detail: result }));
    return result;
  });
})();
