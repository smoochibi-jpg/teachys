(() => {
  const KEY = 'teachysPortfolio';
  const categories = ['Karya siswa', 'Proyek kelas', 'Prestasi', 'Catatan perkembangan', 'Media ajar'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const read = () => { try { const value = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(value) ? value : []; } catch { return []; } };
  let items = read(), query = '', category = 'Semua', selected = null;
  const save = () => window.safeTeachysSetItem(KEY, JSON.stringify(items));
  const students = () => { try { const value=JSON.parse(localStorage.getItem('teachysStudents')); return Array.isArray(value)?value:[]; } catch { return []; } };
  const dateLabel = value => value ? new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${value}T12:00:00`)) : 'Tanpa tanggal';

  function addTab() {
    const tabs = document.querySelector('#pageView .journal-tabs');
    if (!tabs || tabs.querySelector('[data-portfolio-tab]')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.portfolioTab = 'true'; button.textContent = '▧ Portofolio';
    tabs.append(button);
  }
  function openPortfolio() {
    addTab();
    document.querySelectorAll('#pageView .journal-tabs button').forEach(button => button.classList.toggle('active', button.hasAttribute('data-portfolio-tab')));
    document.querySelector('.journal-heading h1').textContent = 'Portofolio Kelas';
    document.querySelector('.journal-heading p').textContent = 'Simpan karya, proyek, prestasi, dan bahan ajar untuk digunakan kembali.';
    const main = document.querySelector('#journalMain');
    if (main) main.innerHTML = render();
    bind();
  }
  function render() {
    const shown = items.filter(item => (category === 'Semua' || item.category === category) && (!query || `${item.title} ${item.studentName||''} ${item.description||''} ${item.category}`.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return `<section class="journal-panel portfolio-page"><div class="portfolio-head"><div><h2>Portofolio Kelas</h2><p>Catatan dan berkas tetap tersimpan di akun Teachy’s, siap dipakai kembali pada tahun ajaran berikutnya.</p></div><button class="primary" id="portfolioAdd">＋ Tambah portofolio</button></div><div class="portfolio-stats"><div><strong>${items.length}</strong><span>Total item</span></div><div><strong>${items.filter(x=>x.category==='Karya siswa').length}</strong><span>Karya siswa</span></div><div><strong>${items.filter(x=>x.fileKey).length}</strong><span>Berkas tersimpan</span></div></div><div class="portfolio-tools"><label>⌕ <input id="portfolioSearch" placeholder="Cari judul, siswa, atau keterangan…" value="${esc(query)}"></label><select id="portfolioCategory">${['Semua',...categories].map(value=>`<option ${category===value?'selected':''}>${value}</option>`).join('')}</select></div><div class="portfolio-grid">${shown.map(item=>card(item)).join('')||'<div class="journal-empty portfolio-empty">Belum ada portofolio yang cocok. Tambahkan karya atau proyek pertamamu.</div>'}</div></section>`;
  }
  function card(item) {
    const image = item.fileType?.startsWith('image/');
    return `<article class="portfolio-card"><div class="portfolio-preview ${image?'has-image':''}">${image?`<img data-storage-key="${esc(item.fileKey)}" alt="${esc(item.title)}">`:`<span>${item.fileKey?'▣':'✦'}</span><small>${item.fileName?esc(item.fileName):'Catatan portofolio'}</small>`}<span class="portfolio-category">${esc(item.category)}</span></div><div class="portfolio-card-body"><small>${dateLabel(item.date)}${item.studentName?` · ${esc(item.studentName)}`:''}</small><h3>${esc(item.title)}</h3><p>${esc(item.description||'Belum ada keterangan.')}</p><div class="portfolio-actions">${item.fileKey?`<a class="pill" href="#" data-portfolio-download="${esc(item.id)}">↓ Buka berkas</a>`:''}<button class="pill" data-portfolio-edit="${esc(item.id)}">Edit</button><button class="pill" data-portfolio-delete="${esc(item.id)}">Hapus</button></div></div></article>`;
  }
  function bind() {
    const root=document.querySelector('#journalMain'); if(!root)return;
    root.querySelector('#portfolioAdd').onclick=()=>form();
    root.querySelector('#portfolioSearch').oninput=event=>{query=event.target.value;const pos=query.length;root.innerHTML=render();bind();const input=root.querySelector('#portfolioSearch');input.focus();input.setSelectionRange(pos,pos);window.imageStore?.muatAset(root)};
    root.querySelector('#portfolioCategory').onchange=event=>{category=event.target.value;root.innerHTML=render();bind();window.imageStore?.muatAset(root)};
    root.querySelectorAll('[data-portfolio-edit]').forEach(button=>button.onclick=()=>form(items.find(item=>item.id===button.dataset.portfolioEdit)));
    root.querySelectorAll('[data-portfolio-delete]').forEach(button=>button.onclick=async()=>{const item=items.find(value=>value.id===button.dataset.portfolioDelete);if(!item||!confirm(`Hapus “${item.title}” dari portofolio?`))return;items=items.filter(value=>value.id!==item.id);save();if(item.fileKey)await window.imageStore?.hapusFile(item.fileKey);openPortfolio()});
    root.querySelectorAll('[data-portfolio-download]').forEach(button=>button.onclick=async event=>{event.preventDefault();const item=items.find(value=>value.id===button.dataset.portfolioDownload);if(!item?.fileKey)return;const url=await window.imageStore?.ambilFile(item.fileKey);if(!url){alert('Berkas belum tersedia di penyimpanan. Pastikan perangkat tersambung internet lalu coba lagi.');return}const link=document.createElement('a');link.href=url;link.download=item.fileName||'berkas-portofolio';link.target='_blank';link.rel='noopener';link.click()});
    window.imageStore?.muatAset(root);
  }
  function form(existing) {
    const overlay=document.querySelector('#overlay'); if(!overlay)return;
    const item=existing||{}, roster=students();
    overlay.innerHTML=`<div class="modalback"><form id="portfolioForm" class="modal student-form portfolio-form"><h2>${existing?'Edit':'Tambah'} Portofolio</h2><label>Judul<input name="title" required maxlength="100" value="${esc(item.title)}" placeholder="Contoh: Poster hemat energi"></label><label>Kategori<select name="category" required>${categories.map(value=>`<option ${item.category===value?'selected':''}>${value}</option>`).join('')}</select></label><label>Nama siswa (opsional)<select name="studentId"><option value="">Portofolio kelas</option>${roster.map(student=>`<option value="${esc(student.id)}" ${item.studentId===student.id?'selected':''}>${esc(student.name)}</option>`).join('')}</select><small>Nama diambil dari Manajemen Kelas.</small></label><label>Tanggal<input name="date" type="date" value="${esc(item.date||new Date().toISOString().slice(0,10))}"></label><label>Keterangan<textarea name="description" rows="3" maxlength="1200" placeholder="Ceritakan proses, tujuan, atau capaian…">${esc(item.description)}</textarea></label><label>Berkas atau media<input name="file" type="file" accept="image/*,.pdf,.ppt,.pptx,.odp,.doc,.docx,.xls,.xlsx,.html,.htm,.mp4,.mp3"><small>${item.fileName?`Berkas saat ini: ${esc(item.fileName)}. Pilih file baru bila ingin menggantinya.`:'Foto, PDF, presentasi, dokumen, atau HTML (maksimal 25 MB).'}</small></label><div class="modalfoot"><button type="button" class="pill" id="portfolioCancel">Batal</button><button class="primary">Simpan portofolio</button></div></form></div>`;
    const form=overlay.querySelector('#portfolioForm');overlay.querySelector('#portfolioCancel').onclick=()=>overlay.innerHTML='';
    form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('[type=submit],button.primary');submit.disabled=true;submit.textContent='Menyimpan…';try{const data=Object.fromEntries(new FormData(form));const student=roster.find(value=>value.id===data.studentId);const next={...item,id:item.id||crypto.randomUUID(),title:data.title.trim(),category:data.category,studentId:data.studentId||'',studentName:student?.name||'',date:data.date,description:data.description.trim(),updatedAt:new Date().toISOString()};const file=form.elements.file.files[0];if(file){if(file.size>25*1024*1024)throw new Error('Ukuran berkas maksimal 25 MB.');const key=`portfolio:${next.id}:${crypto.randomUUID()}`;await window.imageStore.simpanFile(key,file);next.fileKey=key;next.fileName=file.name;next.fileType=file.type||''}items=existing?items.map(value=>value.id===existing.id?next:value):[next,...items];if(!save())throw new Error('Data belum berhasil disimpan. Pastikan ruang penyimpanan tersedia.');if(file&&existing?.fileKey)await window.imageStore?.hapusFile(existing.fileKey);overlay.innerHTML='';openPortfolio()}catch(error){alert(error.message||'Portofolio gagal disimpan.');submit.disabled=false;submit.textContent='Simpan portofolio'}};
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-portfolio-tab]')){event.preventDefault();event.stopImmediatePropagation();openPortfolio()}},true);
  const observer=new MutationObserver(()=>{if(document.querySelector('#pageView .journal-heading h1'))addTab()});
  observer.observe(document.querySelector('#pageView')||document.body,{childList:true,subtree:true});
})();

