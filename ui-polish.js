(() => {
  const body = document.body;
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const more = document.getElementById('sidebarMore');
  const mobileButton = document.getElementById('mobileMenuButton');
  const scrim = document.getElementById('sidebarScrim');
  const collapsedKey = 'teachysSidebarCollapsed';
  if (localStorage.getItem(collapsedKey) === 'true') body.classList.add('sidebar-collapsed');

  const updateToggle = () => {
    const collapsed = body.classList.contains('sidebar-collapsed');
    toggle?.setAttribute('aria-label', collapsed ? 'Lebarkan menu' : 'Ciutkan menu');
    toggle?.setAttribute('title', collapsed ? 'Lebarkan menu' : 'Ciutkan menu');
    if (toggle) toggle.textContent = collapsed ? '›' : '‹';
  };
  updateToggle();
  toggle?.addEventListener('click', () => {
    body.classList.toggle('sidebar-collapsed');
    window.safeTeachysSetItem(collapsedKey, String(body.classList.contains('sidebar-collapsed')));
    updateToggle();
  });
  more?.addEventListener('click', () => sidebar.classList.toggle('show-options'));
  mobileButton?.addEventListener('click', () => body.classList.toggle('sidebar-open'));
  scrim?.addEventListener('click', () => body.classList.remove('sidebar-open'));
  document.getElementById('sidenav')?.addEventListener('click', event => {
    if (event.target.closest('[data-page]')) {
      body.classList.remove('sidebar-open');
      sidebar.classList.remove('show-options');
    }
  });
  document.getElementById('mobilebar')?.addEventListener('click', () => body.classList.remove('sidebar-open'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      body.classList.remove('sidebar-open');
      sidebar.classList.remove('show-options');
    }
  });

  const icon = (glyph, size=18) => window.TeachyIcon(glyph, size);
  document.querySelectorAll('.staticon').forEach(el => { el.innerHTML = icon(el.textContent.trim(), 18); });
  document.querySelectorAll('.quick button span').forEach(el => { el.innerHTML = icon(el.textContent.trim(), 22); });
  document.querySelectorAll('.sidebar>nav:last-of-type .ico').forEach(el => { el.innerHTML = icon('⚙'); });
  const yearIcon = document.querySelector('.year-select>span:first-child');
  if (yearIcon) yearIcon.innerHTML = icon('🗓️');
  const searchIcon = document.querySelector('.search>span');
  if (searchIcon) searchIcon.innerHTML = icon('⌕');
  const bell = document.getElementById('notifyBtn');
  if (bell) bell.childNodes[0].textContent = '';
  if (bell) bell.insertBefore(document.createRange().createContextualFragment(icon('♧')), bell.firstChild);
  const help = document.getElementById('helpBtn');
  if (help) { help.textContent = ''; help.innerHTML = icon('?', 18); }
  const mobile = document.getElementById('mobileMenuButton');
  if (mobile) mobile.innerHTML = icon('☰', 19);
  document.querySelectorAll('.sectionhead h2').forEach(el => {
    const text = el.textContent.trim();
    const glyph = text.charAt(0);
    if (text.length > 1) el.innerHTML = `${icon(glyph,18)}<span>${text.slice(1).trim()}</span>`;
  });
  document.querySelectorAll('.panel-title').forEach(el => {
    const node = [...el.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
    if (node) { const glyph = node.textContent.trim().charAt(0); node.textContent = ''; el.insertBefore(document.createRange().createContextualFragment(icon(glyph,17)), el.firstChild); }
  });
  const decor = document.querySelector('.decoration');
  if (decor && !decor.querySelector('img')) decor.innerHTML = '<span aria-hidden="true">✦</span>';
})();
