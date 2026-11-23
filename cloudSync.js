(() => {
  const cfg = window.TEACHYS_SUPABASE_CONFIG;
  const gate = document.getElementById('cloudGate');
  const form = document.getElementById('cloudAuthForm');
  const message = document.getElementById('cloudAuthMessage');
  const submit = document.getElementById('cloudAuthSubmit');
  const switchMode = document.getElementById('cloudAuthSwitch');
  const logout = document.getElementById('cloudLogout');
  const clientApi = window.supabase;
  const isAppKey = key => key.startsWith('teachys') && key !== 'teachysCloudUserId';
  let client, userId = '', preparingUserId = '', mode = 'signin', syncing = false, applyingCloud = false, hydrating = false, readyPromise;
  const dirty = new Map();
  let lastSavedAt = 0;
  function setSyncBadge(label, state = 'saved') {
    const badge = document.getElementById('cloudSyncLabel');
    if (!badge) return;
    badge.dataset.state = state;
    const time = lastSavedAt ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSavedAt)) : '';
    const hint = time ? `Simpanan terakhir pukul ${time}.` : 'Belum ada waktu simpan terakhir.';
    badge.title = state === 'failed' ? `Gagal tersimpan — ketuk untuk coba lagi. ${hint}` : `${label}. ${hint}`;
    badge.setAttribute('aria-label', badge.title);
    badge.innerHTML = `${window.TeachyIcon?.('cloud-check', 14) || ''}<span>${label}</span>`;
  }
  const localKeys = () => [...new Set([...Object.keys(localStorage), ...window.teachysStorage.pending.keys()])].filter(isAppKey);
  const values = keys => keys.map(key => {
    const raw = window.teachysStorage.pending.get(key) ?? localStorage.getItem(key);
    try { return { user_id: userId, key, value: JSON.parse(raw) }; }
    catch { return { user_id: userId, key, value: raw }; }
  });
  const flash = (text, type = 'info') => {
    message.textContent = text;
    message.dataset.type = type;
  };
  function setGate(open) {
    gate.classList.toggle('hidden', !open);
    document.body.classList.toggle('cloud-locked', open);
  }
  function welcome(user, loading = false) {
    setGate(false);
    const text = document.querySelector('.profiletext');
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Guru';
    if (text) text.innerHTML = `<strong>${name.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong><small>Data tersinkron · ${user.email || ''}</small>`;
    logout.hidden = false;
    document.getElementById('cloudLogoutTop').hidden = false;
    if (loading) {
      setSyncBadge('Memuat…', 'saving');
      document.getElementById('cloudStatus').textContent = 'Menampilkan salinan terbaru sambil memeriksa sinkronisasi…';
    } else {
      lastSavedAt = Date.now();
      setSyncBadge(navigator.onLine ? 'Tersimpan' : 'Offline', navigator.onLine ? 'saved' : 'offline');
      document.getElementById('cloudStatus').textContent = 'Tersambung ke penyimpanan Teachy’s';
    }
  }
  async function applyCloudRows(rows, previousUser) {
    const cloudKeys = new Set(rows.map(row => row.key));
    const oldKeys = localKeys();
    let changed = false;
    if (previousUser && previousUser !== userId) {
      oldKeys.forEach(key => { localStorage.removeItem(key); changed = true; });
    } else if (rows.length) {
      oldKeys.filter(key => !cloudKeys.has(key) && !dirty.has(key)).forEach(key => { localStorage.removeItem(key); changed = true; });
    }
    applyingCloud = true;
    try {
      for (const row of rows) {
        if (dirty.has(row.key)) continue;
        const raw = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
        if (localStorage.getItem(row.key) !== raw) changed = true;
        window.safeTeachysSetItem(row.key, raw);
      }
    } finally { applyingCloud = false; }
    if (!rows.length && !previousUser) {
      const seed = values(localKeys());
      if (seed.length) {
        const { error } = await client.from('teachys_data').upsert(seed, { onConflict: 'user_id,key' });
        if (error) throw error;
      }
    }
    localStorage.setItem('teachysCloudUserId', userId);
    return changed;
  }
  async function syncSession(user) {
    if (!user) {
      userId = '';
      setGate(true);
      return;
    }
    if (user.id === userId && (readyPromise || preparingUserId === user.id)) return readyPromise || Promise.resolve();
    const cachedUserId = localStorage.getItem('teachysCloudUserId') || '';
    const canReuseLocalData = !cachedUserId || cachedUserId === user.id;
    userId = user.id;
    preparingUserId = user.id;
    if (!canReuseLocalData) {
      // Never show the previous account's cached class data after an account switch.
      dirty.clear();
      localKeys().forEach(key => { localStorage.removeItem(key); window.teachysStorage.pending.delete(key); });
      try { await window.imageStore?.clearLocalFiles?.(); }
      catch (error) { console.warn('Cache berkas akun sebelumnya belum dapat dibersihkan.', error.message); }
      localStorage.setItem('teachysCloudUserId', user.id);
      window.teachysRefreshDashboard?.();
    }
    // The account is valid now. The navigation was initialized with the page, so open the
    // shell before the cloud read finishes; cached data remains visible for returning users.
    hydrating = true;
    welcome(user, true);
    document.getElementById('app').classList.remove('cloud-loading');
    preparingUserId = '';
    readyPromise = (async () => {
      const previousUser = localStorage.getItem('teachysCloudUserId') || '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let data, error;
      try {
        ({ data, error } = await client.from('teachys_data').select('key,value').eq('user_id', userId).not('key', 'like', '_filemeta:%').abortSignal(controller.signal));
      } finally { clearTimeout(timeout); }
      if (error) throw error;
      const localChanged = await applyCloudRows(data || [], previousUser);
      welcome(user);
      hydrating = false;
      const pendingSetup = [];
      window.dispatchEvent(new CustomEvent('teachys:cloud-ready', { detail: { user, previousUser, supabase: client, waitUntil: promise => pendingSetup.push(promise) } }));
      await Promise.all(pendingSetup);
      startRealtime();
      if (dirty.size) flushPending();
      if (localChanged) {
        window.teachysRefreshDashboard?.();
        window.dispatchEvent(new CustomEvent('teachys:students-updated'));
        window.dispatchEvent(new CustomEvent('teachys:assets-migrated', { detail: { source: 'cloud' } }));
        window.dispatchEvent(new CustomEvent('teachys:profile-updated', { detail: { source: 'cloud' } }));
        window.dispatchEvent(new CustomEvent('teachys:period-updated', { detail: { source: 'cloud' } }));
      }
      return true;
    })();
    try {
      await readyPromise;
      document.getElementById('app').classList.remove('cloud-loading');
    } catch (error) {
      readyPromise = null;
      hydrating = false;
      const timedOut = error?.name === 'AbortError';
      const notice = timedOut ? 'Pemuatan data terlalu lama. Data lokal tetap bisa dibuka; coba sinkronkan lagi.' : `Data cloud belum termuat: ${error.message || 'koneksi terputus'}. Data lokal tetap bisa dibuka; coba lagi.`;
      flash(notice, 'error');
      setGate(false);
      setSyncBadge(navigator.onLine ? 'Belum tersinkron' : 'Offline', navigator.onLine ? 'failed' : 'offline');
      document.getElementById('cloudStatus').textContent = notice;
      if (dirty.size && navigator.onLine) flushPending();
    }
  }
  let flushTimer;
  function scheduleFlush(event) {
    const key = event?.detail?.key;
    if (!userId || applyingCloud || !key || !isAppKey(key)) return;
    dirty.set(key, !!event.detail.removed);
    if (hydrating) return;
    setSyncBadge(navigator.onLine ? 'Menyimpan…' : 'Offline', navigator.onLine ? 'saving' : 'offline');
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushPending, 550);
  }
  async function flushPending() {
    if (!userId || syncing || !dirty.size) return;
    if (!navigator.onLine) { setSyncBadge('Offline', 'offline'); return; }
    const batch = [...dirty.entries()];
    batch.forEach(([key]) => dirty.delete(key));
    syncing = true;
    setSyncBadge('Menyimpan…', 'saving');
    try {
      const deleted = batch.filter(([, removed]) => removed).map(([key]) => key);
      const changed = batch.filter(([, removed]) => !removed).map(([key]) => key).filter(key => localStorage.getItem(key) !== null || window.teachysStorage.pending.has(key));
      if (deleted.length) {
        const { error } = await client.from('teachys_data').delete().eq('user_id', userId).in('key', deleted);
        if (error) throw error;
      }
      if (changed.length) {
        const { error } = await client.from('teachys_data').upsert(values(changed), { onConflict: 'user_id,key' });
        if (error) throw error;
      }
      document.getElementById('cloudStatus').textContent = 'Semua perubahan tersimpan';
      lastSavedAt = Date.now();
      setSyncBadge('Tersimpan', 'saved');
    } catch (error) {
      batch.forEach(([key, removed]) => dirty.set(key, removed));
      document.getElementById('cloudStatus').textContent = 'Perubahan menunggu jaringan';
      setSyncBadge(navigator.onLine ? 'Gagal tersimpan — ketuk untuk coba lagi' : 'Offline', navigator.onLine ? 'failed' : 'offline');
      console.warn('Sinkronisasi Teachy’s tertunda.', error.message);
      if (navigator.onLine) {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flushPending, 5000);
      }
    } finally { syncing = false; }
  }
  function startRealtime() {
    client.removeAllChannels();
    client.channel(`teachys-data-${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'teachys_data', filter: `user_id=eq.${userId}`
    }, payload => {
      const row = payload.new || payload.old;
      if (!row?.key || row.key.startsWith('_filemeta:')) return;
      if (payload.eventType === 'DELETE') {
        localStorage.removeItem(row.key);
        window.dispatchEvent(new CustomEvent('teachys:cloud-change', { detail: { key: row.key } }));
        if (row.key === 'teachysProfile') window.dispatchEvent(new CustomEvent('teachys:profile-updated'));
      }
      else {
        let raw;
        try { raw = JSON.stringify(row.value); } catch { return; }
        if (localStorage.getItem(row.key) !== raw) {
          window.safeTeachysSetItem(row.key, raw);
          window.dispatchEvent(new CustomEvent('teachys:cloud-change', { detail: { key: row.key } }));
          if (row.key === 'teachys') window.teachysRefreshDashboard?.();
          if (row.key === 'teachysProfile') window.dispatchEvent(new CustomEvent('teachys:profile-updated'));
        }
      }
    }).subscribe();
  }
  async function uploadFile(key, blob, name, type) {
    if (!userId) throw new Error('Masuk ke akun Teachy’s untuk menyimpan berkas ke cloud.');
    const fileName = name || key;
    const fileType = type || blob.type || 'application/octet-stream';
    const path = `${userId}/${encodeURIComponent(key)}/${encodeURIComponent(fileName)}`;
    const allowedTypes = ['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/html','application/octet-stream'];
    const contentType = allowedTypes.includes(fileType) ? fileType : 'application/octet-stream';
    const { error } = await client.storage.from('teachys-files').upload(path, blob, { upsert: true, contentType });
    if (error) throw error;
    const { error: metadataError } = await client.from('teachys_data').upsert({ user_id: userId, key: `_filemeta:${key}`, value: { path, name: fileName, type: fileType } }, { onConflict: 'user_id,key' });
    if (metadataError) throw metadataError;
    return { path, name: fileName, type: fileType };
  }
  async function downloadFile(key) {
    if (!userId) return null;
    const { data: metadataRow, error: metadataError } = await client.from('teachys_data').select('value').eq('user_id', userId).eq('key', `_filemeta:${key}`).maybeSingle();
    if (metadataError || !metadataRow?.value?.path) return null;
    const metadata = metadataRow.value;
    const { data, error } = await client.storage.from('teachys-files').download(metadata.path);
    if (error) return null;
    return { blob: new Blob([data], { type: metadata.type || data.type }), name: metadata.name || key, type: metadata.type || data.type };
  }
  async function removeFile(key) {
    if (!userId) return;
    const metadataKey = `_filemeta:${key}`;
    const { data: metadataRow } = await client.from('teachys_data').select('value').eq('user_id', userId).eq('key', metadataKey).maybeSingle();
    const path = metadataRow?.value?.path;
    if (path) {
      const { error } = await client.storage.from('teachys-files').remove([path]);
      if (error) throw error;
    }
    const { error } = await client.from('teachys_data').delete().eq('user_id', userId).eq('key', metadataKey);
    if (error) throw error;
  }
  window.teachysCloud = {
    get client() { return client; },
    get userId() { return userId; },
    get ready() { return !!userId; },
    uploadFile, downloadFile, removeFile, flush: flushPending
  };
  window.addEventListener('teachys:local-write', scheduleFlush);
  window.addEventListener('storage', event => { if (isAppKey(event.key || '')) scheduleFlush({ detail: { key: event.key, removed: event.newValue === null } }); });
  window.addEventListener('online', () => { if (dirty.size) flushPending(); else setSyncBadge('Tersimpan', 'saved'); });
  window.addEventListener('offline', () => setSyncBadge('Offline', 'offline'));
  document.getElementById('cloudSyncLabel')?.addEventListener('click', () => {
    const badge = document.getElementById('cloudSyncLabel');
    if (badge?.dataset.state !== 'failed') return;
    if (!navigator.onLine) { setSyncBadge('Offline', 'offline'); return; }
    if (dirty.size) flushPending();
    else client.auth.getSession().then(({ data }) => { if (data.session?.user) syncSession(data.session.user); });
  });
  window.addEventListener('teachys:cloud-change', () => {
    window.dispatchEvent(new CustomEvent('teachys:students-updated'));
    window.dispatchEvent(new CustomEvent('teachys:assets-migrated'));
    window.dispatchEvent(new CustomEvent('teachys:period-updated', { detail: { source: 'cloud' } }));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    flash(mode === 'signin' ? 'Sedang masuk…' : 'Membuat akun…');
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    try {
      const result = mode === 'signin'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin === 'null' ? undefined : location.href } });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) flash('Akun dibuat, tetapi belum bisa masuk otomatis. Coba masuk dengan email dan kata sandi.', 'success');
      else {
        // Do not keep the login form disabled while the dashboard data hydrates.
        void syncSession(result.data.user);
      }
    } catch (error) { flash(error.message || 'Masuk gagal. Periksa email dan kata sandi.', 'error'); }
    finally { submit.disabled = false; }
  });
  switchMode.addEventListener('click', () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    submit.textContent = mode === 'signin' ? 'Masuk' : 'Buat akun';
    switchMode.textContent = mode === 'signin' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk';
    document.getElementById('cloudAuthTitle').textContent = mode === 'signin' ? 'Masuk ke Teachy’s' : 'Buat akun guru';
    document.getElementById('cloudAuthHelp').textContent = mode === 'signin'
      ? 'Masuk dengan email dan kata sandi untuk membuka data kelasmu.'
      : 'Daftar dengan email dan kata sandi. Akun langsung bisa digunakan tanpa konfirmasi email.';
  });
  logout.addEventListener('click', async () => { await flushPending(); await client.auth.signOut(); location.reload(); });
  document.getElementById('cloudLogoutTop').addEventListener('click', async () => { await flushPending(); await client.auth.signOut(); location.reload(); });
  if (!clientApi?.createClient) { flash('Pustaka koneksi belum termuat. Periksa koneksi internet lalu muat ulang.', 'error'); setGate(true); return; }
  client = clientApi.createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  setGate(true);
  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    return syncSession(data.session?.user || null);
  }).catch(error => flash(`Koneksi belum berhasil: ${error.message}`, 'error'));
  client.auth.onAuthStateChange((_event, session) => { if (session?.user) syncSession(session.user); else if (_event === 'SIGNED_OUT') syncSession(null); });
})();

