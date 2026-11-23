(() => {
  const KEY = 'teachysProfile';
  const defaults = { schoolName: '', className: '', teacherName: '', teacherNip: '', principalName: '', principalNip: '', signingPlace: '' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function read() {
    try { return { ...defaults, ...JSON.parse(window.teachysStorage.pending.get(KEY) ?? localStorage.getItem(KEY) ?? '{}') }; }
    catch { return { ...defaults }; }
  }

  function migrateIdentityOnce() {
    try { if (window.teachysStorage.pending.has(KEY) || localStorage.getItem(KEY) !== null) return; } catch { return; }
    let books;
    try { books = JSON.parse(localStorage.getItem('teachysAdminBooks') || '{}'); } catch { return; }
    const oldRows = Array.isArray(books.identity) ? books.identity : [];
    const fields = { 'Nama Sekolah': 'schoolName', 'Kelas': 'className', 'Wali Kelas': 'teacherName', 'NIP Wali Kelas': 'teacherNip', 'Kepala Sekolah': 'principalName', 'NIP Kepala Sekolah': 'principalNip', 'Tempat Penandatanganan': 'signingPlace' };
    const sampleValues = new Set(['Nama Sekolah|SD Negeri Harapan', 'Kelas|VI', 'Wali Kelas|Ibu Guru', 'Tahun Pelajaran|2026 / 2027']);
    const profile = { ...defaults };
    for (const row of oldRows) {
      const field = String(row.Bagian || '').trim(), value = String(row.Keterangan || '').trim();
      if (fields[field] && value && !sampleValues.has(`${field}|${value}`)) profile[fields[field]] = value;
    }
    if (Object.values(profile).some(Boolean)) window.safeTeachysSetItem(KEY, JSON.stringify(profile));
  }

  function save(values) {
    const profile = { ...defaults };
    for (const key of Object.keys(defaults)) profile[key] = String(values[key] || '').trim();
    if (!window.safeTeachysSetItem(KEY, JSON.stringify(profile))) return false;
    window.dispatchEvent(new CustomEvent('teachys:profile-updated', { detail: profile }));
    return true;
  }

  function identityRows() {
    const profile = read();
    const schoolYear = document.getElementById('yearText')?.textContent?.trim() || '—';
    return [
      ['Nama Sekolah', profile.schoolName], ['Kelas', profile.className], ['Wali Kelas', profile.teacherName],
      ['NIP Wali Kelas', profile.teacherNip], ['Kepala Sekolah', profile.principalName], ['NIP Kepala Sekolah', profile.principalNip],
      ['Tempat Penandatanganan', profile.signingPlace], ['Tahun Pelajaran', schoolYear]
    ].map(([Bagian, Keterangan], index) => ({ id: `profile-${index}`, Bagian, Keterangan: Keterangan || '—' }));
  }

  function signatureMarkup(date = new Date()) {
    const profile = read();
    const complete = profile.schoolName && profile.className && profile.teacherName && profile.principalName && profile.signingPlace;
    const dateText = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    return `<div class="attendance-signatures document-signatures">${complete ? '' : '<p class="signature-settings-note">Lengkapi nama sekolah, kelas, nama penanda tangan, dan tempat penandatanganan di Pengaturan → Profil & Penanda Tangan.</p>'}<div><p>Mengetahui,<br>Kepala ${escape(profile.schoolName || 'Sekolah')}</p><div class="signature-space"></div><strong>${escape(profile.principalName || '—')}</strong><small>NIP. ${escape(profile.principalNip || '—')}</small></div><div><p>${escape(profile.signingPlace || '—')}, ${escape(dateText)}<br>Wali Kelas ${escape(profile.className || '—')}</p><div class="signature-space"></div><strong>${escape(profile.teacherName || '—')}</strong><small>NIP. ${escape(profile.teacherNip || '—')}</small></div></div>`;
  }

  function updateHeader() {
    const profile = read(), teacher = profile.teacherName || 'Ibu Guru', className = profile.className || 'VI';
    const name = document.querySelector('#profileBtn .profiletext strong'), role = document.querySelector('#profileBtn .profiletext small'), greeting = document.querySelector('#hero .eyebrow');
    if (name) name.textContent = teacher;
    if (role) role.textContent = `Wali Kelas ${className}`;
    if (greeting) greeting.textContent = `SELAMAT PAGI, ${teacher.toLocaleUpperCase('id-ID')} ✨`;
  }

  function openProfilePopover() {
    const profile = read();
    const school = profile.schoolName ? `<p>${escape(profile.schoolName)}</p>` : '';
    const teacher = escape(profile.teacherName || 'Ibu Guru'), className = escape(profile.className || 'VI');
    window.popover('Profil Guru', `${school}<p>${teacher}<br>Wali Kelas ${className}</p><button class="pill" onclick="navigate('Pengaturan');document.querySelector('#overlay').innerHTML=''">Profil & pengaturan →</button>`);
  }

  migrateIdentityOnce();
  window.teachysProfile = { get: read, save, identityRows, signatureMarkup, updateHeader };
  updateHeader();
  if (document.getElementById('profileBtn')) document.getElementById('profileBtn').onclick = openProfilePopover;
  window.addEventListener('teachys:profile-updated', updateHeader);
})();



