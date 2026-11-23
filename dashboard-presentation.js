(() => {
  const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const icon = (element, name, size) => { if (element && window.TeachyIcon) element.innerHTML = window.TeachyIcon(name, size); };
  const menuIcons = {
    'Data siswa': 'users', 'Absensi': 'clipboard-check', 'Daftar nilai': 'clipboard-list',
    'Buku administrasi kelas': 'book-open', 'Modul ajar & LKPD': 'graduation-cap',
    'Jurnal pembelajaran': 'notebook-pen', 'Kegiatan & foto kelas': 'image',
    'Sertifikat & SK': 'award', 'Dokumen & arsip': 'folder-archive', 'Cetak & laporan PDF': 'printer'
  };
  function refineMenuIcons() {
    document.querySelectorAll('#menuGrid .menu-card').forEach(button => {
      const label = button.querySelector('strong')?.textContent.trim(), target = button.querySelector('.big');
      if (menuIcons[label]) icon(target, menuIcons[label], 22);
    });
  }
  function refineHeaderAndStats() {
    icon(document.querySelector('#notifyBtn'), 'bell', 18);
    const stats = ['users','calendar-check','clipboard-list','folder-archive'];
    document.querySelectorAll('#dashboard .staticon').forEach((element,index) => icon(element, stats[index] || 'file-text', 18));
  }
  const pad = value => String(value).padStart(2,'0');
  const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const validDatedRows = (rows, key) => (Array.isArray(rows) ? rows : []).filter(row => {
    const date = row?.date || row?.tanggal || row?.dueDate || row?.deadline || row?.targetDate;
    return typeof date === 'string' && date.slice(0,10) === key;
  });
  function markersFor(key) {
    const markers = [], journal = safeRead('teachysJournal', {})[key];
    if (journal && ((journal.activities||[]).length || (journal.photos||[]).length || String(journal.reflection||'').trim() || journal.status === 'published')) markers.push('1 jurnal');
    const state = safeRead('teachys', {}), tasks = validDatedRows(state.agenda, key), reminders = validDatedRows(state.reminders, key);
    const taskCount = tasks.length + reminders.length;
    if (taskCount) markers.push(`${taskCount} ${taskCount === 1 ? 'tugas' : 'tugas'}`);
    const [year, month, day] = key.split('-').map(Number), grid = safeRead('teachysAttendanceGrid', {}), holiday = grid[`${year}-${pad(month)}`]?.holidays?.[day];
    if (holiday) markers.push(`Libur: ${holiday.note || holiday.type || 'Hari libur'}`);
    return markers;
  }
  function decorateCalendar() {
    document.querySelectorAll('#calendarDays button[data-date]').forEach(button => {
      const date = new Date(Number(button.dataset.year), Number(button.dataset.month), Number(button.dataset.date));
      const markers = markersFor(dateKey(date));
      button.classList.toggle('event', markers.length > 0);
      if (markers.length) button.title = markers.join(' · ');
      else button.removeAttribute('title');
    });
  }
  refineHeaderAndStats();
  refineMenuIcons();
  decorateCalendar();
  new MutationObserver(refineMenuIcons).observe(document.querySelector('#menuGrid'), {childList:true,subtree:true});
  new MutationObserver(decorateCalendar).observe(document.querySelector('#calendarDays'), {childList:true,subtree:true});
  for (const eventName of ['teachys:local-write','teachys:cloud-change','teachys:assets-migrated','storage']) window.addEventListener(eventName, event => {
    const key = event.detail?.key || event.key;
    if (!key || key === 'teachysJournal' || key === 'teachysAttendanceGrid' || key === 'teachys' || key.startsWith('teachys')) decorateCalendar();
  });
  window.addEventListener('focus', decorateCalendar);
})();
