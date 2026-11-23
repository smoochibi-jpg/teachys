(() => {
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const money = value => new Intl.NumberFormat("id-ID", {style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value) || 0);
  const pad = n => String(n).padStart(2, "0");
  const period = () => window.teachysPeriod?.get() || {startYear:new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear()-1, schoolYear:"", semester:new Date().getMonth() >= 6 ? "Ganjil" : "Genap"};
  const months = p => Array.from({length:6}, (_,i) => {
    const d = p.semester === "Ganjil" ? new Date(p.startYear, 6+i, 1) : new Date(p.startYear+1, i, 1);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  });
  const monthTitle = key => new Intl.DateTimeFormat("id-ID", {month:"long",year:"numeric"}).format(new Date(`${key}-01T12:00:00`));
  const dateTitle = key => new Intl.DateTimeFormat("id-ID", {day:"numeric",month:"long",year:"numeric"}).format(new Date(`${key}T12:00:00`));
  const localMonthKey = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
  const profile = () => window.teachysProfile?.get() || {};
  let report = "attendance-month", monthKey = "";
  const reports = [
    ["attendance-month", "Daftar hadir bulanan", "Absensi harian, hari libur, dan tanda tangan."],
    ["attendance-term", "Rekap absensi semester", "Ringkasan hadir, sakit, izin, dan alpa per bulan."],
    ["grades", "Rekap daftar nilai", "Nilai siswa pada semester yang dipilih."],
    ["students", "Daftar siswa", "Data siswa dari Manajemen Kelas."],
    ["journals", "Jurnal pembelajaran", "Jurnal harian yang tersimpan pada semester ini."],
    ["books", "Buku administrasi", "Catatan kelas yang memiliki tanggal pada semester ini."]
  ];
  const students = () => read("teachysStudents", []);
  const render = () => {
    const view = document.querySelector("#pageView");
    if (!view?.classList.contains("reports-view") || document.querySelector("#dashboard")?.classList.contains("hidden") === false) return;
    const p = period(), monthList = months(p);
    if (!monthList.includes(monthKey)) monthKey = monthList.includes(localMonthKey()) ? localMonthKey() : monthList[0];
    view.classList.add("reports-view");
    const profileData = profile();
    view.innerHTML = `<div class="eyebrow">RUANG KERJA · ${esc(p.schoolYear || `${p.startYear} / ${p.startYear+1}`)} · SEMESTER ${esc(p.semester)}</div>
      <div class="reports-heading"><div><h1>▤ Laporan &amp; Cetak</h1><p>Laporan menggunakan data yang sama dengan Manajemen Kelas, Penilaian, Jurnal, dan Buku Administrasi.</p></div><span class="reports-period">${esc(p.schoolYear || `${p.startYear} / ${p.startYear+1}`)} · ${esc(p.semester)}</span></div>
      <div class="reports-controls"><label>Jenis laporan<select id="reportType">${reports.map(([id,title])=>`<option value="${id}" ${report===id?"selected":""}>${title}</option>`).join("")}</select></label><label id="reportMonthWrap" class="${report==="attendance-month"?"":"hidden"}">Bulan<select id="reportMonth">${monthList.map(m=>`<option value="${m}" ${m===monthKey?"selected":""}>${monthTitle(m)}</option>`).join("")}</select></label><span class="reports-controls-spacer"></span><button class="pill" id="refreshReport">↻ Muat ulang data</button><button class="primary" id="printReport">Cetak / Simpan PDF</button></div>
      <div class="reports-types">${reports.map(([id,title,desc])=>`<button class="report-type ${id===report?"active":""}" data-report="${id}"><strong>${title}</strong><small>${desc}</small></button>`).join("")}</div>
      <section class="report-paper" id="reportPaper">${reportMarkup()}</section>`;
    view.querySelector("#reportType").onchange = e => { report=e.target.value; render(); };
    view.querySelector("#reportMonth").onchange = e => { monthKey=e.target.value; render(); };
    view.querySelectorAll("[data-report]").forEach(b => b.onclick=()=>{report=b.dataset.report;render();});
    view.querySelector("#refreshReport").onclick = render;
    view.querySelector("#printReport").onclick = () => window.print();
  };
  const reportMarkup = () => {
    const p = period(), schoolYear = p.schoolYear || `${p.startYear} / ${p.startYear+1}`, profileData=profile(), roster=students();
    const titleBlock = (title, subtitle) => `<header class="report-title"><div class="report-brand">Teachy’s · ${esc(profileData.schoolName || "Administrasi Kelas")}</div><h2>${title}</h2><p>Kelas ${esc(profileData.className || "VI")} · Tahun Pelajaran ${esc(schoolYear)} · Semester ${esc(p.semester)}</p>${subtitle?`<p>${subtitle}</p>`:""}</header>`;
    const empty = text => `<div class="report-empty">${text}</div>`;
    if (report === "students") return `${titleBlock("Daftar Siswa", `${roster.length} siswa terhubung dengan Manajemen Kelas`)}${roster.length?`<table class="report-table"><thead><tr><th>No.</th><th>Nama siswa</th><th>NISN</th><th>Jenis kelamin</th><th>Orang tua / wali</th></tr></thead><tbody>${roster.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.name)}</td><td>${esc(s.nisn)}</td><td>${esc(s.gender)}</td><td>${esc(s.parent)}</td></tr>`).join("")}</tbody></table>`:empty("Belum ada data siswa di Manajemen Kelas.")}`;
    if (report === "attendance-month") {
      const [year, month] = monthKey.split("-").map(Number), count = new Date(year,month,0).getDate(), data=read("teachysAttendanceGrid",{})[monthKey] || {days:{},holidays:{}}, total={H:0,S:0,I:0,A:0}, stats=roster.map(s=>({student:s,counts:{H:0,S:0,I:0,A:0}}));
      const statusFor = (day,s) => data.days?.[day]?.[s.nisn] || "H";
      const isOff = day => new Date(year,month-1,day).getDay()===0 || Boolean(data.holidays?.[day]);
      const workdays=Array.from({length:count},(_,i)=>i+1).filter(day=>!isOff(day));
      stats.forEach(row=>workdays.forEach(day=>row.counts[statusFor(day,row.student)]++));
      stats.forEach(row=>Object.keys(total).forEach(code=>total[code]+=row.counts[code]));
      const cells=Array.from({length:count},(_,i)=>{const day=i+1, holiday=data.holidays?.[day], sunday=new Date(year,month-1,day).getDay()===0;return `<th class="${holiday||sunday?"report-holiday":""}">${day}</th>`}).join("");
      return `${titleBlock("Daftar Hadir Bulanan",monthTitle(monthKey))}<div class="report-metrics"><span>Hadir <b>${total.H}</b></span><span>Sakit <b>${total.S}</b></span><span>Izin <b>${total.I}</b></span><span>Alpa <b>${total.A}</b></span><span>Kehadiran <b>${workdays.length&&roster.length?Math.round(total.H/(workdays.length*roster.length)*100):0}%</b></span></div>${roster.length?`<div class="report-table-wrap"><table class="report-table attendance-report-table"><thead><tr><th class="report-student">Nama siswa</th>${cells}<th>S</th><th>I</th><th>A</th><th>H</th></tr></thead><tbody>${stats.map(row=>`<tr><th class="report-student">${esc(row.student.name)}</th>${Array.from({length:count},(_,i)=>{const day=i+1,holiday=data.holidays?.[day],sunday=new Date(year,month-1,day).getDay()===0;return `<td class="${holiday||sunday?"report-holiday":""}">${holiday||sunday?"":statusFor(day,row.student)==="H"?"•":statusFor(day,row.student)}</td>`}).join("")}<td>${row.counts.S||"—"}</td><td>${row.counts.I||"—"}</td><td>${row.counts.A||"—"}</td><td>${row.counts.H||"—"}</td></tr>`).join("")}</tbody></table></div><div class="report-holiday-notes"><b>Keterangan hari libur</b><span>${Array.from({length:count},(_,i)=>i+1).filter(day=>data.holidays?.[day]||new Date(year,month-1,day).getDay()===0).map(day=>`${day} ${monthTitle(monthKey).split(" ")[0]} — ${esc(data.holidays?.[day]?.note||data.holidays?.[day]?.type||"Libur Minggu")}`).join(" · ")||"Tidak ada"}</span></div>`:empty("Belum ada data siswa. Tambahkan siswa terlebih dahulu di Manajemen Kelas.")}${window.teachysProfile?.signatureMarkup?.() || ""}`;
    }
    if (report === "attendance-term") {
      const grid=read("teachysAttendanceGrid",{}), rosterCount=roster.length;
      const rows=months(p).map(key=>{const [year,month]=key.split("-").map(Number),days=new Date(year,month,0).getDate(),data=grid[key]||{days:{},holidays:{}},counts={H:0,S:0,I:0,A:0};let schoolDays=0;for(let day=1;day<=days;day++){if(new Date(year,month-1,day).getDay()===0||data.holidays?.[day])continue;schoolDays++;for(const s of roster)counts[data.days?.[day]?.[s.nisn]||"H"]++;}const total=schoolDays*rosterCount;return {key,schoolDays,counts,total,pct:total?Math.round(counts.H/total*100):0};});
      return `${titleBlock("Rekap Absensi Semester",`${rosterCount} siswa · ${rows.reduce((n,r)=>n+r.schoolDays,0)} hari sekolah`)}<table class="report-table"><thead><tr><th>Bulan</th><th>Hari sekolah</th><th>Hadir</th><th>Sakit</th><th>Izin</th><th>Alpa</th><th>Persentase hadir</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${monthTitle(r.key)}</td><td>${r.schoolDays}</td><td>${r.counts.H}</td><td>${r.counts.S}</td><td>${r.counts.I}</td><td>${r.counts.A}</td><td>${r.pct}%</td></tr>`).join("")}</tbody></table><p class="report-note">Hari Minggu dan hari libur yang ditandai di menu Absensi tidak dihitung. Kolom yang kosong dihitung sebagai Hadir, sesuai aturan daftar hadir.</p>${window.teachysProfile?.signatureMarkup?.() || ""}`;
    }
    if (report === "grades") {
      const list=read("teachysGrades",[]).filter(g=>!window.teachysPeriod||window.teachysPeriod.includesDate(g.date));
      const body=list.length?list.map(g=>{const scored=roster.map(s=>({s,score:g.scores?.[s.nisn]})).filter(x=>x.score!==undefined&&x.score!=="");const avg=scored.length?Math.round(scored.reduce((a,x)=>a+Number(x.score),0)/scored.length*10)/10:"—";return `<h3 class="report-subhead">${esc(g.title)} · ${esc(g.subject)} · ${dateTitle(g.date)}</h3><p class="report-note">Rata-rata ${avg} dari ${scored.length} nilai · Maksimal ${esc(g.max)}</p><table class="report-table"><thead><tr><th>No.</th><th>Nama siswa</th><th>NISN</th><th>Nilai</th></tr></thead><tbody>${roster.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.name)}</td><td>${esc(s.nisn)}</td><td>${esc(g.scores?.[s.nisn]||"—")}</td></tr>`).join("")}</tbody></table>`}).join(""):empty("Belum ada daftar nilai pada tahun ajaran dan semester yang dipilih.");
      return `${titleBlock("Rekap Daftar Nilai",`${list.length} penilaian tersimpan pada periode ini`)}${body}${window.teachysProfile?.signatureMarkup?.() || ""}`;
    }
    if (report === "journals") {
      const entries=Object.entries(read("teachysJournal",{})).filter(([date])=>!window.teachysPeriod||window.teachysPeriod.includesDate(date)).sort(([a],[b])=>a.localeCompare(b));
      const body=entries.length?entries.map(([date,e])=>`<article class="report-journal"><h3>${dateTitle(date)} · ${e.status==="published"?"Terbit":"Draft"}</h3>${(e.activities||[]).map(a=>`<p><b>${esc(a.subject||"Mata pelajaran")}</b>${a.time?` · ${esc(a.time)}`:""}<br>Materi: ${esc(a.material||"—")}<br>Bahan ajar / media: ${esc(a.media||"—")}<br>Keterangan kegiatan: ${esc(a.notes||"—")}</p>`).join("")}${e.reflection?`<p><b>Refleksi:</b> ${esc(e.reflection)}</p>`:""}<small>${(e.photos||[]).length} foto dokumentasi · ${(e.activities||[]).length} kegiatan</small></article>`).join(""):empty("Belum ada jurnal pada tahun ajaran dan semester yang dipilih.");
      return `${titleBlock("Rekap Jurnal Pembelajaran",`${entries.length} jurnal pada semester ini`)}${body}${window.teachysProfile?.signatureMarkup?.() || ""}`;
    }
    const books=read("teachysAdminBooks",{}), labels={identity:"Identitas Kelas",klaper:"Klaper Siswa",schedule:"Jadwal Pelajaran",piket:"Jadwal Piket",guests:"Buku Tamu",inventory:"Inventaris Kelas",cash:"Kas Kelas",incidents:"Buku Kejadian"}, entries=Object.entries(books).flatMap(([id,rows])=>Array.isArray(rows)?rows.filter(row=>!row.Tanggal||!window.teachysPeriod||window.teachysPeriod.includesDate(row.Tanggal)).map(row=>({title:labels[id]||id,row})):[]);
    return `${titleBlock("Rekap Buku Administrasi",`${entries.length} catatan kelas yang tersedia pada periode ini`)}${entries.length?`<table class="report-table"><thead><tr><th>Buku</th><th>Tanggal</th><th>Catatan</th></tr></thead><tbody>${entries.map(({title,row})=>`<tr><td>${esc(title)}</td><td>${esc(row.Tanggal||"—")}</td><td>${esc(Object.entries(row).filter(([k])=>k!=="Tanggal"&&k!=="id").map(([k,v])=>`${k}: ${v}`).join(" · "))}</td></tr>`).join("")}</tbody></table>`:empty("Belum ada catatan buku administrasi pada periode ini.")}${window.teachysProfile?.signatureMarkup?.() || ""}`;
  };
  window.teachysReports = { open: () => { document.querySelector("#pageView")?.classList.add("reports-view"); report="attendance-month"; const ms=months(period()); monthKey=ms.includes(localMonthKey())?localMonthKey():ms[0]; render(); window.scrollTo({top:0,behavior:"smooth"}); }, refresh:render };
  window.addEventListener("teachys:period-updated", render);
  window.addEventListener("teachys:students-updated", render);
  window.addEventListener("teachys:profile-updated", render);
  window.addEventListener("storage", e => { if (["teachysPeriod","teachysStudents","teachysAttendanceGrid","teachysGrades","teachysJournal","teachysAdminBooks"].includes(e.key)) render(); });
})();
