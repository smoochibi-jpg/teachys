(() => {
  const root = document.getElementById('journalWidgetList');
  if (!root) return;
  const read = () => {
    try { return JSON.parse(localStorage.getItem('teachysJournal') || '{}'); }
    catch { return {}; }
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  function render() {
    const journal = read();
    const latest = Object.entries(journal)
      .filter(([date, entry]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && entry && typeof entry === 'object')
      .filter(([date]) => !window.teachysPeriod || window.teachysPeriod.includesDate(date))
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3);
    root.innerHTML = latest.length ? latest.map(([date, entry]) => {
      const dateText = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
      const subjects = (entry.activities || []).map(activity => activity.subject).filter(Boolean).slice(0, 2).join(' · ') || 'Belum ada mata pelajaran';
      const photos = (entry.photos || []).length;
      const published = entry.status === 'published';
      return `<button class="journal-widget-item" type="button" data-journal-date="${date}"><span class="journal-widget-icon">▤</span><span class="journal-widget-copy"><strong>${escapeHtml(dateText)}</strong><small>${escapeHtml(subjects)}${photos ? ` · ${photos} foto` : ''}</small></span><span class="journal-widget-status ${published ? 'published' : ''}">${published ? 'Terbit' : 'Draft'}</span></button>`;
    }).join('') : '<div class="journal-widget-empty">Belum ada jurnal. Buat jurnal pertamamu hari ini.</div>';
  }
  function openJournal() {
    document.querySelector('#sidenav [data-page="Jurnal & Portofolio"]')?.click();
  }
  root.addEventListener('click', event => {
    if (event.target.closest('[data-journal-date]')) openJournal();
  });
  document.getElementById('openJournalWidget')?.addEventListener('click', openJournal);
  window.addEventListener('teachys:local-write', event => { if (event.detail?.key === 'teachysJournal') render(); });
  window.addEventListener('teachys:cloud-change', event => { if (event.detail?.key === 'teachysJournal') render(); });
  window.addEventListener('teachys:assets-migrated', render);
  window.addEventListener('teachys:period-updated', render);
  window.addEventListener('storage', event => { if (event.key === 'teachysJournal') render(); });
  render();
})();

