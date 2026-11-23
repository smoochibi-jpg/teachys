(() => {
  const KEY = 'teachysPeriod';
  const currentDate = new Date();
  const semesterOf = dateValue => {
    const date = dateValue instanceof Date ? dateValue : parseDate(dateValue);
    if (!date || Number.isNaN(date.getTime())) return null;
    const month = date.getMonth() + 1, year = date.getFullYear();
    const startYear = month >= 7 ? year : year - 1;
    return { startYear, schoolYear: `${startYear} / ${startYear + 1}`, semester: month >= 7 ? 'Ganjil' : 'Genap' };
  };
  function parseDate(value) {
    if (value instanceof Date) return value;
    const match = String(value || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }
  function read() {
    const fallback = semesterOf(currentDate);
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && Number.isInteger(Number(saved.startYear)) && ['Ganjil', 'Genap'].includes(saved.semester)) {
        const startYear = Number(saved.startYear);
        return { startYear, schoolYear: `${startYear} / ${startYear + 1}`, semester: saved.semester };
      }
    } catch { /* Fall back to the date in the user's current locale. */ }
    return fallback;
  }
  let selected = read();
  const includesDate = value => {
    const date = parseDate(value);
    if (!date) return false;
    const derived = semesterOf(date);
    return derived.startYear === selected.startYear && derived.semester === selected.semester;
  };
  const startDate = () => selected.semester === 'Ganjil' ? new Date(selected.startYear, 6, 1) : new Date(selected.startYear + 1, 0, 1);
  const firstMonth = () => `${startDate().getFullYear()}-${String(startDate().getMonth() + 1).padStart(2, '0')}`;
  function set(next, source = 'header') {
    const startYear = Number(next.startYear), semester = next.semester;
    if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2200 || !['Ganjil', 'Genap'].includes(semester)) return false;
    const nextPeriod = { startYear, schoolYear: `${startYear} / ${startYear + 1}`, semester };
    if (!window.safeTeachysSetItem(KEY, JSON.stringify({ startYear, semester }))) return false;
    selected = nextPeriod;
    renderLabel();
    window.dispatchEvent(new CustomEvent('teachys:period-updated', { detail: { ...selected, source } }));
    return true;
  }
  function renderLabel() {
    const label = document.getElementById('yearText');
    if (label) label.textContent = selected.schoolYear;
    const button = document.getElementById('yearBtn');
    if (button) button.setAttribute('aria-label', `Filter tahun pelajaran ${selected.schoolYear}, semester ${selected.semester}`);
  }
  function showPicker() {
    const now = semesterOf(new Date()), min = Math.min(now.startYear, selected.startYear) - 5, max = Math.max(now.startYear, selected.startYear) + 1;
    const options = Array.from({ length: max - min + 1 }, (_, index) => min + index).map(year => `<option value="${year}" ${year === selected.startYear ? 'selected' : ''}>${year} / ${year + 1}</option>`).join('');
    window.popover('Filter Tahun Pelajaran', `<p>Pilih tahun ajaran dan semester yang ingin ditampilkan.</p><label style="display:block;font-size:10px;color:var(--muted);margin:8px 0 4px">Tahun pelajaran</label><select id="yearPick" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px">${options}</select><label style="display:block;font-size:10px;color:var(--muted);margin:10px 0 4px">Semester</label><select id="semesterPick" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px"><option value="Ganjil" ${selected.semester === 'Ganjil' ? 'selected' : ''}>Ganjil · Juli–Desember</option><option value="Genap" ${selected.semester === 'Genap' ? 'selected' : ''}>Genap · Januari–Juni</option></select><button class="primary" id="applyPeriod" style="width:100%;margin-top:12px">Tampilkan periode</button>`);
    document.getElementById('applyPeriod')?.addEventListener('click', () => {
      const year = Number(document.getElementById('yearPick').value), semester = document.getElementById('semesterPick').value;
      if (!set({ startYear: year, semester })) { window.toast('Pilihan periode belum tersimpan. Ruang penyimpanan mungkin penuh.'); return; }
      document.getElementById('overlay').innerHTML = '';
    });
  }
  renderLabel();
  if (document.getElementById('yearBtn')) document.getElementById('yearBtn').onclick = showPicker;
  window.teachysPeriod = { get: () => ({ ...selected }), semesterOf, includesDate, includesMonth: month => includesDate(`${month}-01`), startDate, firstMonth, set };
})();


