(() => {
  const hero = document.getElementById('hero');
  const heroArt = document.getElementById('heroArt');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('overlay');
  const bannerKey = 'dashboard-banner';
  const sidebarKey = 'sidebar-background';
  const accept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

  function displayBanner(url) {
    hero.classList.toggle('has-custom-banner', Boolean(url));
    if (url) {
      hero.style.setProperty('background-image', `url("${url}")`, 'important');
      hero.style.setProperty('background-size', 'cover', 'important');
      hero.style.setProperty('background-position', 'center', 'important');
    } else {
      hero.style.removeProperty('background-image');
      hero.style.removeProperty('background-size');
      hero.style.removeProperty('background-position');
    }
    heroArt.classList.toggle('hidden', Boolean(url));
    if (!url) heroArt.textContent = '👩🏻‍🏫';
  }

  function displaySidebar(url) {
    let layer = document.getElementById('sidebarBannerLayer');
    if (!url) {
      sidebar.classList.remove('has-banner');
      layer?.remove();
      return;
    }
    if (!layer) {
      layer = document.createElement('img');
      layer.id = 'sidebarBannerLayer';
      layer.className = 'sidebar-banner-layer';
      layer.alt = '';
      layer.setAttribute('aria-hidden', 'true');
      sidebar.insertBefore(layer, sidebar.firstChild);
    }
    layer.src = url;
    sidebar.classList.add('has-banner');
  }

  function openPhotoDialog(key, title, applyImage) {
    overlay.innerHTML = `<div class="modalback" data-photo-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="photoDialogTitle"><h2 id="photoDialogTitle">${title}</h2><p>Pilih foto JPG, PNG, atau WebP. Ukuran maksimal 5 MB.</p><input id="photoDialogInput" type="file" accept="${accept}" hidden><div class="modalrow"><span>Foto</span><button class="pill" id="photoChoose">Pilih foto</button></div><p id="photoStatus" role="status" aria-live="polite"></p><div class="modalfoot"><button class="ghost-btn" id="photoRestore">Kembalikan ke bawaan</button><button class="primary" id="photoClose">Selesai</button></div></section></div>`;
    const input = document.getElementById('photoDialogInput');
    const status = document.getElementById('photoStatus');
    document.getElementById('photoChoose').onclick = () => input.click();
    document.getElementById('photoClose').onclick = () => { overlay.innerHTML = ''; };
    document.getElementById('photoRestore').onclick = async () => {
      const restore = document.getElementById('photoRestore');
      restore.disabled = true;
      status.textContent = 'Mengembalikan tampilan bawaan…';
      try {
        await window.imageStore.hapusGambar(key);
        applyImage(null);
        status.textContent = 'Tampilan bawaan sudah dipulihkan.';
      } catch (error) {
        status.textContent = error.message || 'Foto belum bisa dihapus. Coba lagi.';
        restore.disabled = false;
      }
    };
    overlay.onclick = event => {
      if (event.target.matches('[data-photo-backdrop]')) overlay.innerHTML = '';
    };
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const choose = document.getElementById('photoChoose');
      choose.disabled = true;
      status.textContent = 'Memuat dan menyimpan foto…';
      try {
        const url = await window.imageStore.simpanGambar(key, file);
        applyImage(url);
        status.textContent = 'Foto berhasil dipasang dan tersimpan.';
      } catch (error) {
        status.textContent = error.message || 'Foto belum bisa dipasang. Coba lagi.';
        choose.disabled = false;
        input.value = '';
      }
    };
  }

  document.getElementById('uploadBanner').onclick = () => openPhotoDialog(bannerKey, 'Edit banner', displayBanner);
  document.getElementById('removeBanner').onclick = () => openPhotoDialog(bannerKey, 'Edit banner', displayBanner);
  const editSidebar = document.getElementById('sidebarBannerBtn');
  const cleanEditSidebar = editSidebar.cloneNode(true);
  editSidebar.replaceWith(cleanEditSidebar);
  cleanEditSidebar.addEventListener('click', () => openPhotoDialog(sidebarKey, 'Edit latar sidebar', displaySidebar));
  const clearSidebar = document.getElementById('clearSidebarBanner');
  const cleanClearSidebar = clearSidebar.cloneNode(true);
  clearSidebar.replaceWith(cleanClearSidebar);
  cleanClearSidebar.addEventListener('click', () => openPhotoDialog(sidebarKey, 'Edit latar sidebar', displaySidebar));

  async function loadImage(key, display, legacyKey) {
    let url = await window.imageStore.ambilGambar(key);
    if (!url && legacyKey) {
      const legacyData = localStorage.getItem(legacyKey);
      if (legacyData?.startsWith('data:image/')) {
        const legacyBlob = await fetch(legacyData).then(response => response.blob());
        url = await window.imageStore.simpanGambar(key, legacyBlob);
        window.teachysStorage.removeItem(legacyKey);
      }
    }
    display(url);
  }
  Promise.all([
    loadImage(bannerKey, displayBanner),
    loadImage(sidebarKey, displaySidebar, 'teachysSidebarBanner')
  ]).catch(error => {
    if (typeof window.toast === 'function') window.toast(error.message || 'Foto tersimpan belum bisa dibuka.');
  });
})();
