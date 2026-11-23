(() => {
  const LS_PREFIX = 'teachys';
  const LAST_BACKUP = 'teachysBackupLastAt';
  const migrationNames = { '2027-01-18':'Jurnal 18 Januari 2027', '2027-01-19':'Jurnal 19 Januari 2027', '2027-01-20':'Jurnal 20 Januari 2027', '2027-01-21':'Jurnal 21 Januari 2027' };
  const sampleStudents = new Map([
    ['s1',{name:'Aditya Pratama',nisn:'0123456701',gender:'Laki-laki',parent:'Budi Pratama'}],['s2',{name:'Aisyah Putri',nisn:'0123456702',gender:'Perempuan',parent:'Siti Rahma'}],
    ['s3',{name:'Bima Saputra',nisn:'0123456703',gender:'Laki-laki',parent:'Dewi Saputra'}],['s4',{name:'Citra Maharani',nisn:'0123456704',gender:'Perempuan',parent:'Agus Maharani'}],
    ['s5',{name:'Daffa Ramadhan',nisn:'0123456705',gender:'Laki-laki',parent:'Rina Ramadhan'}],['s6',{name:'Farah Nabila',nisn:'0123456706',gender:'Perempuan',parent:'Hendra Nabila'}],
    ['s7',{name:'Gilang Maulana',nisn:'0123456707',gender:'Laki-laki',parent:'Lestari Maulana'}],['s8',{name:'Intan Permata',nisn:'0123456708',gender:'Perempuan',parent:'Dedi Permata'}]
  ]);
  const sampleBooks = {
    identity:[{Bagian:'Nama Sekolah',Keterangan:'SD Negeri Harapan'},{Bagian:'Kelas',Keterangan:'VI'},{Bagian:'Wali Kelas',Keterangan:'Ibu Guru'},{Bagian:'Tahun Pelajaran',Keterangan:'2026 / 2027'}],
    piket:[{Hari:'Senin','Nama Siswa':'Aditya, Aisyah',Tugas:'Menyapu dan merapikan meja'}],
    inventory:[{'Nama Barang':'Meja siswa',Jumlah:'16',Kondisi:'Baik',Keterangan:''},{'Nama Barang':'Papan tulis',Jumlah:'1',Kondisi:'Baik',Keterangan:''}],
    cash:[{Tanggal:'2026-07-20',Keterangan:'Iuran kelas',Pemasukan:'160000',Pengeluaran:'0'}]
  };
  const sampleActivities = {
    a1:['Matematika','07.30 – 08.40','Perbandingan senilai','Buku siswa, LKPD, benda konkret (gelas ukur dan air)','Siswa mengamati contoh perbandingan dalam kehidupan sehari-hari, melakukan praktik menggunakan benda konkret, kemudian mengerjakan LKPD secara berkelompok.'],
    a2:['IPAS','09.00 – 10.10','Kedatangan bangsa Portugis di Indonesia','Buku paket, gambar sejarah, video pembelajaran','Diskusi dan pengamatan gambar mengenai kedatangan bangsa Portugis, kemudian siswa menyusun garis waktu peristiwa secara berkelompok.'],
    a3:['Bahasa Indonesia','08.00 – 09.20','Menemukan gagasan pokok','Buku bacaan dan lembar kerja','Membaca teks dan menandai gagasan pokok setiap paragraf.'],
    a4:['Matematika','10.00 – 11.00','Pecahan','Kartu pecahan','Latihan kelompok membandingkan pecahan.'],
    a5:['Pendidikan Pancasila','07.30 – 08.40','Musyawarah','Kartu situasi','Simulasi musyawarah kelas dan refleksi bersama.'],
    a6:['IPAS','08.00 – 09.00','Ekosistem','Gambar lingkungan','Mengidentifikasi hubungan antarmakhluk hidup.']
  };
  const isSampleActivity = activity => {const expected=sampleActivities[activity.id];return expected&&expected[0]===activity.subject&&expected[1]===activity.time&&expected[2]===activity.material&&expected[3]===activity.media&&expected[4]===activity.notes&&!(activity.attachments||[]).length};
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeSet = (k,v) => window.teachysStorage.setItem(k,v);
  const safeRemove = k => window.teachysStorage.removeItem(k);

  function readLocalData() {
    const localStorageData = {};
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if(key?.startsWith(LS_PREFIX))localStorageData[key]=localStorage.getItem(key);
    }
    for (const [key,value] of window.teachysStorage.pending) if(key.startsWith(LS_PREFIX))localStorageData[key]=value;
    return localStorageData;
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Berkas cadangan gagal dibaca.'));reader.readAsDataURL(blob)});
  }
  function dataUrlToBlob(dataUrl) {
    const [header, encoded] = dataUrl.split(',');
    const type = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    return new Blob([bytes], { type });
  }
  async function buildBackup(includeFiles=true) {
    const files=[];
    if(includeFiles){
      const stored=await window.imageStore.daftarFile(false);
      for(const item of stored)files.push({key:item.key,name:item.name,type:item.type,dataUrl:await blobToDataUrl(item.blob)});
    }
    return {format:'teachys-backup',version:1,createdAt:new Date().toISOString(),localStorage:readLocalData(),files,filesIncluded:includeFiles};
  }
  function downloadJson(data,name) {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function saveInternalBackup(key) {
    const data=await buildBackup(true);
    await window.imageStore.simpanFile(key,new Blob([JSON.stringify(data)],{type:'application/json'}));
    return data;
  }
  function sampleSelection() {
    const counts={students:0,journalActivities:0,books:0,dashboardItems:0},assetKeys=[];
    let students=[];try{students=JSON.parse(localStorage.getItem('teachysStudents')||'[]')}catch{}
    counts.students=students.filter(s=>{const expected=sampleStudents.get(s.id);return expected&&Object.entries(expected).every(([key,value])=>s[key]===value)}).length;
    let journal={};try{journal=JSON.parse(localStorage.getItem('teachysJournal')||'{}')}catch{}
    for(const [date,entry] of Object.entries(journal)){
      const expectedReflection=date==='2027-01-21'?'Siswa cukup antusias mengikuti pembelajaran. Beberapa siswa masih membutuhkan pendampingan ketika mengerjakan soal.':'';
      for(const activity of entry.activities||[]){
        if(isSampleActivity(activity)){counts.journalActivities++;(activity.attachments||[]).forEach(file=>file.storageKey&&assetKeys.push(file.storageKey))}
      }
      const remaining=(entry.activities||[]).filter(activity=>!isSampleActivity(activity));
      if(!remaining.length&&!(entry.photos||[]).length&&entry.reflection===expectedReflection&&migrationNames[date])counts.journalActivities+=0;
    }
    let books={};try{books=JSON.parse(localStorage.getItem('teachysAdminBooks')||'{}')}catch{}
    for(const [bookId,seeds] of Object.entries(sampleBooks)){
      for(const row of books[bookId]||[])if(!row.proofKey&&!row.proofData&&seeds.some(seed=>Object.entries(seed).every(([key,value])=>row[key]===value)))counts.books++;
    }
    let state={};try{state=JSON.parse(localStorage.getItem('teachys')||'{}')}catch{}
    const demoAgenda=new Map([['Literasi pagi bersama',['07.15 – 07.45',true]],['Pembelajaran Matematika',['08.00 – 09.30',false]],['Diskusi kelompok P5',['10.00 – 11.00',false]]]);
    const demoReminders=new Map([['Input nilai tema 6',false],['Lengkapi jurnal pembelajaran',false],['Unggah foto kegiatan minggu ini',true]]);
    counts.dashboardItems=(state.agenda||[]).filter(x=>demoAgenda.has(x.t)&&demoAgenda.get(x.t)[0]===x.time&&demoAgenda.get(x.t)[1]===x.done).length+(state.reminders||[]).filter(x=>demoReminders.has(x.text)&&demoReminders.get(x.text)===x.done).length;
    return {counts,assetKeys};
  }

  function formatBytes(value) {
    if(!Number.isFinite(value))return 'belum diketahui';
    if(value<1024)return `${value} B`;
    if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
    return `${(value/(1024*1024)).toFixed(1)} MB`;
  }
  function openSettings() {
    const last=localStorage.getItem(LAST_BACKUP),lastDate=last?new Date(last):null;
    const overdue=!lastDate||Date.now()-lastDate.getTime()>30*24*60*60*1000;
    document.getElementById('overlay').innerHTML=`<div class="modalback" data-data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dataSettingsTitle"><h2 id="dataSettingsTitle">Data & penyimpanan</h2><p id="storageUsage">Memeriksa ruang penyimpanan…</p><p id="migrationStatus">Memeriksa pemindahan lampiran…</p><p>Cadangan terakhir: ${lastDate?lastDate.toLocaleDateString('id-ID'):'belum ada'}${overdue?' · sudah waktunya membuat cadangan.':''}</p><label style="display:flex;align-items:center;gap:8px;margin:12px 0"><input id="includeBackupFiles" type="checkbox" checked> Sertakan foto dan lampiran</label><div class="modalrow"><button class="pill" id="downloadBackup">Unduh cadangan (.json)</button><label class="pill" for="restoreBackupFile">Pulihkan dari cadangan<input id="restoreBackupFile" type="file" accept=".json,application/json" hidden></label></div><p id="backupStatus" role="status" aria-live="polite"></p><div class="modalrow"><span>Data contoh</span><button class="pill" id="previewSampleCleanup">Hapus data contoh</button></div><p id="sampleStatus" role="status">Memuat ringkasan data contoh…</p><div class="modalfoot"><button class="pill" id="migrationBackupDownload">Unduh cadangan sebelum migrasi</button><button class="pill" id="cleanupBackupDownload">Unduh cadangan sebelum hapus contoh</button><button class="primary" id="dataSettingsClose">Selesai</button></div></section></div>`;
    document.getElementById('dataSettingsClose').onclick=()=>document.getElementById('overlay').innerHTML='';
    document.getElementById('overlay').onclick=e=>{if(e.target.matches('[data-data-backdrop]'))document.getElementById('overlay').innerHTML=''};
    updateUsage();
    let migration={};try{migration=JSON.parse(localStorage.getItem('teachysMigrationResult')||'{}')}catch{}
    const migrationStatus=document.getElementById('migrationStatus');
    migrationStatus.textContent=migration.completed?`Migrasi media selesai: ${migration.migrated||0} file dipindahkan${migration.skipped?`, ${migration.skipped} sudah berbentuk referensi`:''}.`:migration.message||'Migrasi media sedang berjalan atau belum dimulai.';
    const summary=sampleSelection().counts;
    document.getElementById('sampleStatus').textContent=`Terdeteksi: ${summary.students} siswa, ${summary.journalActivities} kegiatan jurnal, ${summary.books} baris buku, dan ${summary.dashboardItems} agenda/pengingat contoh.`;
    document.getElementById('downloadBackup').onclick=async()=>{
      const status=document.getElementById('backupStatus');status.textContent='Membuat cadangan…';
      try{const include=document.getElementById('includeBackupFiles').checked,data=await buildBackup(include),now=new Date(),localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;downloadJson(data,`Teachys-cadangan-${localDate}.json`);safeSet(LAST_BACKUP,new Date().toISOString());status.textContent=`Cadangan siap: ${Object.keys(data.localStorage).length} data dan ${data.files.length} berkas.`}
      catch(error){status.textContent=error.message||'Cadangan gagal dibuat.'}
    };
    document.getElementById('migrationBackupDownload').onclick=async()=>{
      const status=document.getElementById('backupStatus');status.textContent='Membuka cadangan sebelum migrasi…';
      try{const url=await window.imageStore.unduhCadanganMigrasi();if(!url){status.textContent='Cadangan migrasi belum tersedia.';return}const a=document.createElement('a');a.href=url;a.download='Teachys-cadangan-sebelum-migrasi.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status.textContent='Cadangan sebelum migrasi berhasil diunduh.'}
      catch(error){status.textContent=error.message||'Cadangan migrasi belum bisa dibuka.'}
    };
    document.getElementById('cleanupBackupDownload').onclick=async()=>{
      const status=document.getElementById('backupStatus');status.textContent='Mencari cadangan penghapusan…';
      try{const items=(await window.imageStore.daftarFile(true)).filter(item=>item.key.startsWith('backup:hapus-data-contoh:')).sort((a,b)=>b.updatedAt-a.updatedAt);if(!items.length){status.textContent='Belum ada cadangan penghapusan data contoh.';return}const url=URL.createObjectURL(items[0].blob),a=document.createElement('a');a.href=url;a.download='Teachys-cadangan-sebelum-hapus-data-contoh.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status.textContent='Cadangan otomatis berhasil diunduh.'}
      catch(error){status.textContent=error.message||'Cadangan otomatis belum bisa dibuka.'}
    };
    document.getElementById('previewSampleCleanup').onclick=()=>openSampleCleanup();
    document.getElementById('restoreBackupFile').onchange=e=>previewRestore(e.target.files?.[0]);
  }
  async function updateUsage(){
    const node=document.getElementById('storageUsage');if(!node)return;
    const info=await window.teachysStorage.estimate();
    if(!info?.quota){node.textContent='Pemakaian ruang penyimpanan tidak tersedia di browser ini.';return}
    const percent=Math.round((info.usage||0)/info.quota*100);
    node.textContent=`Ruang terpakai ${formatBytes(info.usage||0)} dari ${formatBytes(info.quota)} (${percent}%).${percent>=80?' Ruang mulai penuh; unduh cadangan dan hapus berkas yang tidak dibutuhkan.':''}`;
  }

  function openSampleCleanup(){
    const snapshot=sampleSelection(),{students,journalActivities,books,dashboardItems}=snapshot.counts;
    document.getElementById('overlay').innerHTML=`<div class="modalback"><section class="modal"><h2>Periksa data contoh</h2><p>Yang akan dihapus hanya baris yang cocok dengan data bawaan Teachy’s.</p><div class="modalrow"><span>Data siswa</span><strong>${students}</strong></div><div class="modalrow"><span>Kegiatan jurnal</span><strong>${journalActivities}</strong></div><div class="modalrow"><span>Baris buku administrasi</span><strong>${books}</strong></div><div class="modalrow"><span>Agenda dan pengingat</span><strong>${dashboardItems}</strong></div><p>Sebelum menghapus, aplikasi membuat cadangan otomatis. Data yang kamu ubah atau tambahkan sendiri akan dipertahankan.</p><label>Ketik <strong>HAPUS DATA CONTOH</strong> untuk melanjutkan<input id="sampleConfirmText" autocomplete="off"></label><div class="modalfoot"><button class="pill" id="sampleCancel">Batal</button><button class="primary" id="sampleDelete" disabled>Cadangkan dan hapus</button></div><p id="sampleDeleteStatus" role="status"></p></section></div>`;
    const input=document.getElementById('sampleConfirmText'),button=document.getElementById('sampleDelete');
    input.oninput=()=>button.disabled=input.value!=='HAPUS DATA CONTOH';
    document.getElementById('sampleCancel').onclick=openSettings;
    button.onclick=async()=>{
      button.disabled=true;document.getElementById('sampleDeleteStatus').textContent='Membuat cadangan…';
      try{await saveInternalBackup(`backup:hapus-data-contoh:${Date.now()}`);applySampleCleanup();document.getElementById('sampleDeleteStatus').textContent='Data contoh terpilih berhasil dihapus; data lainnya tetap ada.';setTimeout(openSettings,800)}
      catch(error){document.getElementById('sampleDeleteStatus').textContent=error.message||'Data belum dihapus karena cadangan gagal dibuat.';button.disabled=false}
    };
  }
  function applySampleCleanup(){
    const selected=sampleSelection();
    const students=JSON.parse(localStorage.getItem('teachysStudents')||'[]').filter(s=>{const expected=sampleStudents.get(s.id);return !(expected&&Object.entries(expected).every(([key,value])=>s[key]===value))});
    const journal=JSON.parse(localStorage.getItem('teachysJournal')||'{}');
    const expectedReflection={'2027-01-21':'Siswa cukup antusias mengikuti pembelajaran. Beberapa siswa masih membutuhkan pendampingan ketika mengerjakan soal.','2027-01-20':'','2027-01-19':'','2027-01-18':''};
    const expectedStatus={'2027-01-21':'published','2027-01-20':'published','2027-01-19':'published','2027-01-18':'draft'};
    for(const [date,entry] of Object.entries(journal)){
      if(!migrationNames[date])continue;
      entry.activities=(entry.activities||[]).filter(activity=>!isSampleActivity(activity));
      if(!entry.activities.length&&!(entry.photos||[]).length&&entry.reflection===expectedReflection[date]&&entry.status===expectedStatus[date])delete journal[date];
    }
    const books=JSON.parse(localStorage.getItem('teachysAdminBooks')||'{}');
    for(const [bookId,seeds] of Object.entries(sampleBooks))if(Array.isArray(books[bookId]))books[bookId]=books[bookId].filter(row=>row.proofKey||row.proofData||!seeds.some(seed=>Object.entries(seed).every(([key,value])=>row[key]===value)));
    let state=JSON.parse(localStorage.getItem('teachys')||'{}');
    const demoAgenda=new Map([['Literasi pagi bersama',['07.15 – 07.45',true]],['Pembelajaran Matematika',['08.00 – 09.30',false]],['Diskusi kelompok P5',['10.00 – 11.00',false]]]),demoReminders=new Map([['Input nilai tema 6',false],['Lengkapi jurnal pembelajaran',false],['Unggah foto kegiatan minggu ini',true]]);
    state.agenda=(state.agenda||[]).filter(item=>!(demoAgenda.has(item.t)&&demoAgenda.get(item.t)[0]===item.time&&demoAgenda.get(item.t)[1]===item.done));state.reminders=(state.reminders||[]).filter(item=>!(demoReminders.has(item.text)&&demoReminders.get(item.text)===item.done));
    const changes={teachysStudents:JSON.stringify(students),teachysJournal:JSON.stringify(journal),teachysAdminBooks:JSON.stringify(books),teachys:JSON.stringify(state)};
    const old={};for(const key of Object.keys(changes))old[key]=localStorage.getItem(key);
    for(const [key,value] of Object.entries(changes))if(!safeSet(key,value)){for(const [oldKey,oldValue] of Object.entries(old)){if(oldValue!==null)safeSet(oldKey,oldValue);else safeRemove(oldKey)}throw new Error('Penghapusan dibatalkan karena penyimpanan browser penuh. Cadangan otomatis tetap tersedia.')}
    selected.assetKeys.forEach(key=>window.imageStore.hapusFile(key));
    window.dispatchEvent(new CustomEvent('teachys:students-updated',{detail:students}));
    window.dispatchEvent(new CustomEvent('teachys:assets-migrated',{detail:{completed:true,cleanup:true}}));
  }

  async function previewRestore(file){
    const status=document.getElementById('backupStatus');if(!file)return;
    try{
      const backup=JSON.parse(await file.text());
      if(backup.format!=='teachys-backup'||!backup.localStorage||!Array.isArray(backup.files)||Object.keys(backup.localStorage).some(key=>!key.startsWith(LS_PREFIX))||backup.files.some(asset=>typeof asset.key!=='string'||!asset.key||typeof asset.dataUrl!=='string'||!asset.dataUrl.startsWith('data:')))throw new Error('File ini bukan cadangan Teachy’s yang valid.');
      status.textContent=`Pratinjau: ${Object.keys(backup.localStorage).length} data dan ${backup.files.length} berkas. Klik Pulihkan untuk melanjutkan.`;
      document.getElementById('confirmRestore')?.remove();const restore=document.createElement('button');restore.className='primary';restore.id='confirmRestore';restore.textContent='Pulihkan cadangan';document.querySelector('.modalfoot').prepend(restore);
      restore.onclick=async()=>{
        restore.disabled=true;status.textContent='Membuat cadangan kondisi saat ini…';let rollback=null;
        try{
          rollback=await buildBackup(true);
          await saveInternalBackup(`backup:sebelum-pulih:${Date.now()}`);
          status.textContent='Memulihkan data…';
          for(const asset of backup.files)await window.imageStore.pulihkanFile({...asset,blob:dataUrlToBlob(asset.dataUrl)});
          for(const item of await window.imageStore.daftarFile(false))if(!backup.files.some(asset=>asset.key===item.key))await window.imageStore.hapusFile(item.key);
          for(const key of Object.keys(readLocalData()))if(!(key in backup.localStorage))safeRemove(key);
          for(const [key,value] of Object.entries(backup.localStorage))if(!safeSet(key,value))throw new Error('Sebagian data belum tersimpan karena ruang browser penuh. Cadangan sebelumnya aman.');
          status.textContent='Cadangan berhasil dipulihkan. Memuat ulang Teachy’s…';setTimeout(()=>location.reload(),700);
        }catch(error){
          if(!rollback){status.textContent=error.message||'Cadangan kondisi saat ini gagal dibuat; tidak ada data yang diubah.';restore.disabled=false;return}
          try{
            for(const item of await window.imageStore.daftarFile(false))await window.imageStore.hapusFile(item.key);
            for(const asset of rollback.files)await window.imageStore.pulihkanFile({...asset,blob:dataUrlToBlob(asset.dataUrl)});
            for(const key of Object.keys(readLocalData()))if(!(key in rollback.localStorage))safeRemove(key);
            for(const [key,value] of Object.entries(rollback.localStorage))safeSet(key,value);
            status.textContent=`Pemulihan tidak selesai: ${error.message||'terjadi kendala'}. Data sebelumnya sudah dikembalikan.`;
          }catch(rollbackError){status.textContent=`Pemulihan gagal (${error.message||'kendala'}), dan pengembalian otomatis juga gagal. Cadangan sebelum pemulihan tersedia.`}
          restore.disabled=false
        }
      };
    }catch(error){status.textContent=error.message||'File cadangan tidak bisa dibaca.'}
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('#dataStorageSettings')){event.preventDefault();openSettings()}
  });
})();
