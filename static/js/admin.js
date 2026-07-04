/* ── admin.js ── All admin dashboard logic ── */

/* ── Toast ──────────────────────────────────── */
function toast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span style="flex:1;">${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>t.remove(), 4500);
}

/* ── Modal ───────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ── Theme ───────────────────────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const dark  = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('theme', dark ? 'light' : 'dark');
  const btn1 = document.getElementById('theme-btn');
  const btn2 = document.getElementById('theme-settings-btn');
  if (btn1) btn1.textContent = dark ? '🌙' : '☀️';
  if (btn2) btn2.textContent = dark ? '☀️ Switch to Dark Mode' : '🌙 Switch to Light Mode';
}
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn1 = document.getElementById('theme-btn');
  if (btn1) btn1.textContent = saved === 'dark' ? '🌙' : '☀️';
}

/* ── Section Nav ─────────────────────────────── */
const sectionNames = {
  dashboard:'Dashboard', students:'Students', attendance:'Attendance',
  gate:'Gate Log', leaves:'Leave Management', settings:'Settings'
};
function showSection(name) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(item=>{
    if(item.textContent.trim().toLowerCase().startsWith(name.split('-')[0]))
      item.classList.add('active');
  });
  document.getElementById('page-title').textContent = sectionNames[name]||name;
  if(name==='dashboard')  loadDashboard();
  if(name==='students')   loadStudents();
  if(name==='attendance') loadAttendance();
  if(name==='gate')       loadGateLogs();
  if(name==='leaves')     loadLeaves();
  if(name==='settings')   loadSettings();
}

/* ── Date helpers ────────────────────────────── */
function todayIST()  { return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}); }
function fmtDT(iso)  { if(!iso)return'—'; try{return new Date(iso).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return iso;} }
function fmtDate(d)  { try{return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});}catch{return d;} }
function greeting()  { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; }

function setTopbar() {
  const now=new Date(), opts={timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',year:'numeric'};
  const dateStr = now.toLocaleDateString('en-IN',opts);
  document.getElementById('topbar-date').textContent = dateStr;
  document.getElementById('dash-date-label').textContent = dateStr;
  const h = new Date().getHours();
  const greet = h<12 ? 'Good morning!' : h<17 ? 'Good afternoon!' : 'Good evening!';
  document.getElementById('dash-greeting').textContent = greet + ' 👋';
}

/* ── Photo Preview ───────────────────────────── */
function previewPhoto(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('photo-preview');
    img.src = e.target.result; img.style.display='block';
    document.getElementById('photo-placeholder').style.display='none';
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════════════════
   MULTI-STEP WIZARD
══════════════════════════════════════════ */
let _wizardStep = 1;
const _WIZARD_TOTAL = 3;

function resetWizard() {
  _wizardStep = 1;
  ['s-name','s-phone','s-village','s-college','s-course','s-room','s-hostel-number']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('s-year').value = '';
  document.getElementById('photo-input').value = '';
  document.getElementById('photo-preview').style.display='none';
  document.getElementById('photo-placeholder').style.display='block';
  document.getElementById('cred-result').style.display='none';
  [1,2,3].forEach(i => {
    document.getElementById('err-name') && (document.getElementById('err-name').classList.remove('show'));
    document.getElementById('err-phone') && (document.getElementById('err-phone').classList.remove('show'));
    document.getElementById('err-college') && (document.getElementById('err-college').classList.remove('show'));
    document.getElementById('err-hostel') && (document.getElementById('err-hostel').classList.remove('show'));
  });
  _updateWizardUI();
}

function _updateWizardUI() {
  for(let i=1; i<=_WIZARD_TOTAL; i++) {
    const stepEl = document.getElementById(`ws-step-${i}`);
    const bodyEl = document.getElementById(`ws-body-${i}`);
    const circ   = document.getElementById(`ws-circle-${i}`);
    if(!stepEl) continue;
    if(i < _wizardStep) {
      stepEl.className='ws-step done'; circ.textContent='✓';
    } else if(i === _wizardStep) {
      stepEl.className='ws-step active'; circ.textContent=String(i);
    } else {
      stepEl.className='ws-step'; circ.textContent=String(i);
    }
    if(bodyEl) bodyEl.style.display = i===_wizardStep ? 'block' : 'none';
    // Update connector line
    const lineEl = document.getElementById(`ws-line-${i}`);
    if(lineEl) lineEl.className = i < _wizardStep ? 'ws-line done' : 'ws-line';
  }
  const prev   = document.getElementById('ws-prev-btn');
  const next   = document.getElementById('ws-next-btn');
  const submit = document.getElementById('ws-submit-btn');
  const done   = document.getElementById('ws-done-btn');
  if(prev)   prev.style.display   = _wizardStep > 1 && document.getElementById('cred-result').style.display==='none' ? 'inline-flex' : 'none';
  if(next)   next.style.display   = _wizardStep < _WIZARD_TOTAL && document.getElementById('cred-result').style.display==='none' ? 'inline-flex' : 'none';
  if(submit) submit.style.display = _wizardStep === _WIZARD_TOTAL && document.getElementById('cred-result').style.display==='none' ? 'inline-flex' : 'none';
  if(done)   done.style.display   = document.getElementById('cred-result').style.display !== 'none' ? 'inline-flex' : 'none';
  document.getElementById('wizard-title').textContent =
    ['➕ Add New Student', 'Academic Details', '🏠 Hostel Details'][_wizardStep-1];
}

function wizardNext() {
  if(!_validateWizardStep(_wizardStep)) return;
  if(_wizardStep < _WIZARD_TOTAL) { _wizardStep++; _updateWizardUI(); }
}
function wizardPrev() {
  if(_wizardStep > 1) { _wizardStep--; _updateWizardUI(); }
}

function _validateWizardStep(step) {
  let ok = true;
  if(step===1) {
    const name  = (document.getElementById('s-name').value||'').trim();
    const phone = (document.getElementById('s-phone').value||'').trim();
    const roll  = (document.getElementById('s-roll').value||'').trim();
    _setErr('err-name',  !name,  's-name');
    _setErr('err-phone', phone && !/^\d{10}$/.test(phone), 's-phone');
    _setErr('err-roll',  !roll,  's-roll');
    ok = !!name && !!roll && (!phone || /^\d{10}$/.test(phone));
  }
  if(step===2) {
    const college = (document.getElementById('s-college').value||'').trim();
    _setErr('err-college', !college, 's-college');
    ok = !!college;
  }
  if(step===3) {
    const hostel = (document.getElementById('s-hostel-number').value||'').trim();
    _setErr('err-hostel', !hostel, 's-hostel-number');
    ok = !!hostel;
  }
  return ok;
}

function _setErr(errId, show, inputId) {
  const errEl = document.getElementById(errId);
  const inpEl = document.getElementById(inputId);
  if(errEl) errEl.classList.toggle('show', !!show);
  if(inpEl) inpEl.classList.toggle('error', !!show);
}

/* Dynamic custom field generator in admin wizard */
let _customFieldCount = 0;
function addCustomFieldToWizard() {
  const container = document.getElementById('wizard-extra-fields-container');
  const div = document.createElement('div');
  div.id = `custom-field-row-${_customFieldCount}`;
  div.className = 'input-group';
  div.style.marginBottom = '6px';
  div.innerHTML = `
    <input class="form-control" type="text" placeholder="Detail Name (e.g. Blood Group)" style="font-size:12px; padding:6px 10px;" id="cf-label-${_customFieldCount}">
    <input class="form-control" type="text" placeholder="Value (e.g. O+)" style="font-size:12px; padding:6px 10px;" id="cf-val-${_customFieldCount}">
    <button type="button" class="btn btn-xs btn-danger" onclick="document.getElementById('custom-field-row-${_customFieldCount}').remove()">✕</button>
  `;
  container.appendChild(div);
  _customFieldCount++;
}

async function submitAddStudent() {
  if(!_validateWizardStep(3)) return;
  const btn    = document.getElementById('ws-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Adding...';

  const fd = new FormData();
  fd.append('name',          document.getElementById('s-name').value.trim());
  fd.append('roll_number',   document.getElementById('s-roll').value.trim());
  fd.append('phone',         document.getElementById('s-phone').value.trim());
  fd.append('email',         document.getElementById('s-email').value.trim());
  fd.append('village',       document.getElementById('s-village').value.trim());
  fd.append('college',       document.getElementById('s-college').value.trim());
  fd.append('course',        document.getElementById('s-course').value.trim());
  fd.append('year',          document.getElementById('s-year').value);
  fd.append('hostel_number', document.getElementById('s-hostel-number').value.trim());
  fd.append('room',          document.getElementById('s-room').value.trim());
  
  // Append custom extra fields
  for(let i=0; i<_customFieldCount; i++) {
    const lblEl = document.getElementById(`cf-label-${i}`);
    const valEl = document.getElementById(`cf-val-${i}`);
    if(lblEl && valEl && lblEl.value.trim()) {
      fd.append(lblEl.value.trim(), valEl.value.trim());
    }
  }

  const photoFile = document.getElementById('photo-input').files[0];
  if(photoFile) fd.append('photo', photoFile);

  try {
    const res  = await fetch('/api/admin/students',{method:'POST',body:fd});
    const data = await res.json();
    if(res.ok) {
      document.getElementById('cred-user').textContent = data.username;
      document.getElementById('cred-pass').textContent = data.password;
      document.getElementById('cred-result').style.display = 'block';
      toast(`Student ${data.name} added successfully!`, 'success');
      _updateWizardUI();
      loadStudents();
    } else {
      toast(data.error||'Failed to add student', 'error');
      btn.disabled=false; btn.textContent='✅ Add Student';
    }
  } catch(e) {
    toast('Network error!','error');
    btn.disabled=false; btn.textContent='✅ Add Student';
  }
}

/* ── Dashboard ───────────────────────────────── */
async function loadDashboard() {
  try {
    const [sRes, oRes, lRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/currently-out'),
      fetch('/api/admin/leaves?status=pending')
    ]);
    const stats = await sRes.json();
    const out   = await oRes.json();
    const pLeaves = await lRes.json();

    ['total','present','absent','leave'].forEach(k=>{
      const el=document.getElementById(`stat-${k}`);
      if(el) el.textContent=stats[k]||0;
    });
    document.getElementById('stat-out').textContent     = stats.currently_out||0;
    document.getElementById('stat-pending').textContent = stats.pending_leaves||0;

    // Badges
    const outBadge = document.getElementById('currently-out-badge');
    if(outBadge) { outBadge.style.display = stats.currently_out>0?'inline-flex':'none'; document.getElementById('out-count').textContent=stats.currently_out||0; }
    const lb = document.getElementById('leaves-badge');
    if(lb) { lb.style.display=stats.pending_leaves>0?'inline-flex':'none'; lb.textContent=stats.pending_leaves||0; }

    // Currently out list
    const outEl = document.getElementById('currently-out-list');
    outEl.innerHTML = out.length===0
      ? `<div class="empty-state"><div class="icon">🏠</div><p>All students are inside</p></div>`
      : out.map(s=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:20px;">🚶</span>
          <div><div style="font-size:13px;font-weight:600;">${s.student_name||'Unknown'}</div>
          <div style="font-size:11px;color:var(--text2);">${fmtDT(s.timestamp)}</div></div>
        </div>`).join('');

    // Pending leaves
    const plEl = document.getElementById('dash-pending-leaves');
    plEl.innerHTML = pLeaves.length===0
      ? `<div class="empty-state"><div class="icon">✅</div><p>No pending leaves</p></div>`
      : pLeaves.slice(0,5).map(l=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:20px;">📋</span>
          <div style="flex:1;"><div style="font-size:13px;font-weight:600;">${l.student_name}</div>
          <div style="font-size:11px;color:var(--text2);">${l.from_date} → ${l.to_date}</div></div>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-xs btn-success" onclick="quickReview('${l._id}','approved')">✓</button>
            <button class="btn btn-xs btn-danger"  onclick="quickReview('${l._id}','rejected')">✗</button>
          </div>
        </div>`).join('');
  } catch(e) { console.error('Dashboard error',e); }
}

async function quickReview(id, status) {
  try {
    await fetch(`/api/admin/leaves/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    toast(`Leave ${status}!`, status==='approved'?'success':'warning');
    loadDashboard();
  } catch(e) { toast('Error!','error'); }
}

/* ── Students ────────────────────────────────── */
let _allStudents = [];
async function loadStudents() {
  const grid = document.getElementById('students-grid');
  grid.innerHTML = '<div class="spinner-center"><div class="loader"></div></div>';
  try {
    const res = await fetch('/api/admin/students');
    _allStudents = await res.json();
    renderStudentGrid(_allStudents);
  } catch(e) {
    grid.innerHTML = '<div class="empty-state"><p>Error loading students</p></div>';
  }
}

function renderStudentGrid(students) {
  const grid = document.getElementById('students-grid');
  if(students.length===0) {
    grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;"><div class="icon">👥</div><p>No students found. Click "Add Student" to get started.</p></div>';
    return;
  }
  grid.innerHTML = students.map(s => {
    const init = (s.name||'?')[0].toUpperCase();
    const tags = [
      s.year        && `<span class="tag accent">📚 ${s.year}</span>`,
      s.hostel_number && `<span class="tag info">🏠 ${s.hostel_number}</span>`,
      s.room        && `<span class="tag">🚪 Room ${s.room}</span>`,
    ].filter(Boolean).join('');
    return `
    <div class="student-card">
      ${s.photo
        ? `<img src="${s.photo}" class="student-avatar" alt="${esc(s.name)}" onerror="this.outerHTML='<div class=student-avatar-placeholder>${init}</div>'">`
        : `<div class="student-avatar-placeholder">${init}</div>`}
      <div class="student-name">${esc(s.name)}</div>
      <div class="student-meta">
        ${s.roll_number ? `<div>🆔 Roll: ${esc(s.roll_number)}</div>` : ''}
        ${s.phone       ? `<div>📞 Phone: ${esc(s.phone)}</div>`   : ''}
        ${s.email       ? `<div>✉️ Email: ${esc(s.email)}</div>`   : ''}
      </div>
      <div class="student-tags">${tags}</div>
      <div style="font-size:11px;color:var(--text2);font-family:monospace;margin-bottom:10px;">${s.username}</div>
      <div class="card-actions">
        <button class="btn btn-xs btn-secondary" onclick="resetStudentPwd('${s._id}','${esc(s.name)}')">🔑 Reset</button>
        <button class="btn btn-xs btn-danger"    onclick="deleteStudent('${s._id}','${esc(s.name)}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function filterStudents() {
  const q    = (document.getElementById('student-search').value||'').toLowerCase();
  const sort = document.getElementById('student-sort').value;
  let list   = _allStudents.filter(s =>
    !q || s.name?.toLowerCase().includes(q)
       || s.room?.toLowerCase().includes(q)
       || s.roll_number?.toLowerCase().includes(q)
       || s.phone?.toLowerCase().includes(q)
       || s.email?.toLowerCase().includes(q)
       || s.username?.toLowerCase().includes(q)
  );
  if(sort==='name') list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if(sort==='room') list.sort((a,b)=>(a.room||'').localeCompare(b.room||''));
  renderStudentGrid(list);
}

async function deleteStudent(id, name) {
  if(!confirm(`Remove ${name} from hostel?`)) return;
  try {
    const res = await fetch(`/api/admin/students/${id}`,{method:'DELETE'});
    if(res.ok) { toast(`${name} removed`,'success'); loadStudents(); }
    else { const d=await res.json(); toast(d.error,'error'); }
  } catch(e) { toast('Error!','error'); }
}

async function resetStudentPwd(id, name) {
  if(!confirm(`Reset password for ${name}?`)) return;
  try {
    const res  = await fetch(`/api/admin/students/${id}/reset-password`,{method:'POST'});
    const data = await res.json();
    if(res.ok) {
      document.getElementById('modal-cred-user').textContent = data.username;
      document.getElementById('modal-cred-pass').textContent = data.password;
      openModal('cred-modal');
    } else toast(data.error,'error');
  } catch(e) { toast('Error!','error'); }
}

/* ── Attendance ──────────────────────────────── */
async function loadAttendance() {
  const dateEl = document.getElementById('att-date');
  const date   = dateEl.value || todayIST();
  if(!dateEl.value) dateEl.value = date;
  document.getElementById('att-date-label').textContent = fmtDate(date) + ' Attendance';
  const tbody = document.getElementById('att-tbody');
  tbody.innerHTML='<tr><td colspan="8"><div class="spinner-center"><div class="loader"></div></div></td></tr>';
  try {
    const res  = await fetch(`/api/admin/attendance?date=${date}`);
    const rows = await res.json();
    let p=0,a=0,l=0;
    rows.forEach(r=>{ if(r.status==='present')p++; else if(r.status==='leave')l++; else a++; });
    document.getElementById('att-count-p').textContent=`${p} Present`;
    document.getElementById('att-count-a').textContent=`${a} Absent`;
    document.getElementById('att-count-l').textContent=`${l} Leave`;
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${r.photo?`<img src="${r.photo}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;">` : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;">${(r.name[0]||'?')}</div>`}</td>
        <td style="font-weight:700;">${esc(r.name)}</td>
        <td>${r.room||'—'}</td>
        <td style="font-family:monospace;font-size:12px;">${r.username}</td>
        <td><span class="badge badge-${r.status}">${{present:'✅ Present',absent:'❌ Absent',leave:'🏖️ Leave'}[r.status]||r.status}</span></td>
        <td style="font-size:12px;">${r.marked_at||'—'}</td>
        <td style="font-size:11px;color:var(--text2);">${r.marked_by||'—'}</td>
        <td>
          <select class="form-control" style="padding:4px 8px;font-size:12px;max-width:110px;" onchange="adminMarkAtt('${r.student_id}','${date}',this.value)">
            <option value="present" ${r.status==='present'?'selected':''}>✅ Present</option>
            <option value="absent"  ${r.status==='absent' ?'selected':''}>❌ Absent</option>
            <option value="leave"   ${r.status==='leave'  ?'selected':''}>🏖️ Leave</option>
          </select>
        </td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="8"><div class="empty-state"><p>Error loading attendance</p></div></td></tr>';
  }
}

async function adminMarkAtt(sid, date, status) {
  try {
    const res = await fetch('/api/admin/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({student_id:sid,date,status})});
    if(res.ok) toast('Attendance updated!','success');
    else { const d=await res.json(); toast(d.error,'error'); }
  } catch(e) { toast('Error!','error'); }
}

async function loadMonthly() {
  const month  = document.getElementById('month-select').value;
  if(!month) return;
  const tbody  = document.getElementById('monthly-tbody');
  tbody.innerHTML='<tr><td colspan="6"><div class="spinner-center"><div class="loader"></div></div></td></tr>';
  try {
    const res  = await fetch(`/api/admin/attendance/monthly?month=${month}`);
    const data = await res.json();
    if(data.length===0) { tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text2);">No data for this month</td></tr>'; return; }
    const days = new Date(month.split('-')[0], month.split('-')[1], 0).getDate();
    tbody.innerHTML = data.map(s=>`
      <tr>
        <td style="font-weight:700;">${esc(s.name)}</td>
        <td>${s.room||'—'}</td>
        <td style="font-size:12px;color:var(--text2);">${s.college||'—'}</td>
        <td style="color:var(--success);font-weight:700;">${s.present||0}</td>
        <td style="color:var(--info);font-weight:700;">${s.leave||0}</td>
        <td style="color:var(--danger);font-weight:700;">${Math.max(0,days-(s.present||0)-(s.leave||0))}</td>
      </tr>`).join('');
  } catch(e) { tbody.innerHTML='<tr><td colspan="6">Error</td></tr>'; }
}

function exportMonthlyCSV() {
  const month = document.getElementById('month-select').value;
  if(!month) { toast('Please select a month first', 'error'); return; }
  const rows = document.querySelectorAll('#monthly-tbody tr');
  if(rows.length === 0 || rows[0].textContent.includes('No data')) { toast('No data to export', 'error'); return; }
  let csv = 'Name,Room,College,Present,Leave,Absent (est.)\n';
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if(cells.length >= 6) csv += `"${cells[0].textContent}","${cells[1].textContent}","${cells[2].textContent}","${cells[3].textContent}","${cells[4].textContent}","${cells[5].textContent}"\n`;
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `monthly_summary_${month}.csv`;
  a.click();
}

function downloadAttendance() {
  const date = document.getElementById('att-date').value || todayIST();
  const rows = document.querySelectorAll('#att-tbody tr');
  let csv = 'Name,Room,Username,Status,Marked At,Marked By\n';
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if(cells.length>6) csv+=`"${cells[1].textContent}","${cells[2].textContent}","${cells[3].textContent}","${cells[4].textContent}","${cells[5].textContent}","${cells[6].textContent}"\n`;
  });
  const a = document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`attendance_${date}.csv`; a.click();
}

/* ── Gate Logs ───────────────────────────────── */
async function loadGateLogs() {
  const dateEl = document.getElementById('gate-date');
  const date   = dateEl.value || todayIST();
  if(!dateEl.value) dateEl.value = date;
  document.getElementById('gate-date-label').textContent = fmtDate(date) + ' Gate Log';
  const tbody = document.getElementById('gate-tbody');
  tbody.innerHTML='<tr><td colspan="6"><div class="spinner-center"><div class="loader"></div></div></td></tr>';
  try {
    const res  = await fetch(`/api/admin/gate-logs?date=${date}`);
    const logs = await res.json();
    if(logs.length===0) { tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="icon">🚪</div><p>No gate activity this day</p></div></td></tr>'; return; }
    tbody.innerHTML = logs.map(l => {
      let duration = '—';
      if(l.action==='out' && l.return_time) {
        const diff = new Date(l.return_time) - new Date(l.timestamp);
        const mins = Math.round(diff/60000);
        duration = mins>60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
      }
      return `<tr>
        <td style="font-weight:700;">${esc(l.student_name||'—')}</td>
        <td><span class="badge badge-${l.action}">${l.action==='out'?'🚪 OUT':'🏠 IN'}</span></td>
        <td>${fmtDT(l.timestamp)}</td>
        <td>${l.return_time ? fmtDT(l.return_time) : (l.action==='out'?'<span style="color:var(--warning)">Still out</span>':'—')}</td>
        <td style="font-size:12px;">${duration}</td>
        <td style="font-size:12px;color:var(--text2);">${esc(l.reason||'—')}</td>
        <td>
          <button class="btn btn-xs btn-danger" onclick="deleteGateLog('${l._id}')" title="Delete Log">🗑️</button>
        </td>
      </tr>`;}).join('');
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="7"><p>Error loading gate logs</p></td></tr>';
  }
}

async function deleteGateLog(id) {
  if(!confirm('Are you sure you want to delete this gate log?')) return;
  try {
    const res = await fetch(`/api/admin/gate_log/${id}`, {method:'DELETE'});
    if(res.ok) { toast('Gate log deleted', 'success'); loadGateLogs(); }
    else toast('Error deleting gate log', 'error');
  } catch(e) { toast('Error deleting gate log', 'error'); }
}

/* ── Leaves ──────────────────────────────────── */
async function loadLeaves() {
  const status = document.getElementById('leave-filter').value;
  const url    = status ? `/api/admin/leaves?status=${status}` : '/api/admin/leaves';
  const tbody  = document.getElementById('leaves-tbody');
  tbody.innerHTML='<tr><td colspan="7"><div class="spinner-center"><div class="loader"></div></div></td></tr>';
  try {
    const res    = await fetch(url);
    const leaves = await res.json();
    if(leaves.length===0) { tbody.innerHTML='<tr><td colspan="7"><div class="empty-state"><div class="icon">🏖️</div><p>No leave applications</p></div></td></tr>'; return; }
    tbody.innerHTML = leaves.map(l=>`
      <tr>
        <td style="font-weight:700;">${esc(l.student_name)}</td>
        <td>${l.from_date}</td><td>${l.to_date}</td>
        <td style="font-size:12px;max-width:180px;">${esc(l.reason)}</td>
        <td style="font-size:11px;color:var(--text2);">${fmtDT(l.created_at)}</td>
        <td><span class="badge badge-${l.status}">${l.status.toUpperCase()}</span></td>
        <td>${l.status==='pending'
          ?`<button class="btn btn-xs btn-success" onclick="reviewLeave('${l._id}','approved')">✓ Approve</button>
             <button class="btn btn-xs btn-danger"  onclick="reviewLeave('${l._id}','rejected')" style="margin-left:4px;">✗ Reject</button>`
          :`<span style="font-size:11px;color:var(--text2);">${l.reviewed_by||'Admin'}</span>`}
          <button class="btn btn-xs btn-danger" onclick="deleteLeave('${l._id}')" title="Delete Leave" style="margin-left:8px;">🗑️</button>
        </td>
      </tr>`).join('');
  } catch(e) { tbody.innerHTML='<tr><td colspan="7"><p>Error loading leaves</p></td></tr>'; }
}

async function deleteLeave(id) {
  if(!confirm('Are you sure you want to delete this leave application?')) return;
  try {
    const res = await fetch(`/api/admin/leave/${id}`, {method:'DELETE'});
    if(res.ok) { toast('Leave deleted', 'success'); loadLeaves(); }
    else toast('Error deleting leave', 'error');
  } catch(e) { toast('Error deleting leave', 'error'); }
}

async function reviewLeave(id, status) {
  try {
    const res = await fetch(`/api/admin/leaves/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    const data = await res.json();
    if(res.ok) { toast(`Leave ${status}!`, status==='approved'?'success':'warning'); loadLeaves(); loadDashboard(); }
    else toast(data.error,'error');
  } catch(e) { toast('Error!','error'); }
}

/* ── Settings ────────────────────────────────── */
async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const cfg = await res.json();
    document.getElementById('hostel-name').value   = cfg.hostel_name||'Raj Ganga Gopalak Chatralaya';
    document.getElementById('geo-enabled').checked = cfg.enabled||false;
    if(cfg.lat) document.getElementById('geo-lat').value = cfg.lat;
    if(cfg.lon) document.getElementById('geo-lon').value = cfg.lon;
    document.getElementById('geo-radius').value = cfg.radius||100;
  } catch(e) { toast('Error loading settings','error'); }
}

async function saveSettings() {
  const data = {
    hostel_name: document.getElementById('hostel-name').value.trim(),
    enabled: document.getElementById('geo-enabled').checked,
    lat: parseFloat(document.getElementById('geo-lat').value)||null,
    lon: parseFloat(document.getElementById('geo-lon').value)||null,
    radius: parseInt(document.getElementById('geo-radius').value)||100
  };
  try {
    const res = await fetch('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(res.ok) toast('Settings saved!','success');
    else { const d=await res.json(); toast(d.error,'error'); }
  } catch(e) { toast('Error!','error'); }
}

function useMyLocation() {
  const el = document.getElementById('location-status');
  el.textContent='📡 Getting location...'; el.style.color='';
  if(!navigator.geolocation) { el.textContent='❌ Not supported'; return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    document.getElementById('geo-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('geo-lon').value = pos.coords.longitude.toFixed(6);
    el.textContent=`✅ Set: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (±${pos.coords.accuracy.toFixed(0)}m)`;
    el.style.color='var(--success)';
  },err=>{
    el.textContent='❌ '+err.message; el.style.color='var(--danger)';
  },{enableHighAccuracy:true,timeout:15000});
}

/* ── Logout ──────────────────────────────────── */
async function doLogout() {
  await fetch('/api/logout',{method:'POST'});
  window.location.href='/';
}

/* ── Helpers ─────────────────────────────────── */
function esc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══════════════════════════════════════════
   BULK IMPORT LOGIC
══════════════════════════════════════════ */
let bulkParsedStudents=[]; let bulkImportResults=[];

function showBulkStep(n) {
  [1,2,3].forEach(i=>{const el=document.getElementById(`bulk-step-${i}`);if(el)el.style.display=i===n?'block':'none';});
}
function resetBulk() {
  bulkParsedStudents=[]; bulkImportResults=[];
  document.getElementById('bulk-textarea').value='';
  showBulkStep(1);
  const btn=document.getElementById('bulk-import-btn');
  if(btn){btn.disabled=false;btn.textContent='🚀 Import All';}
}
function fillBulkExample() {
  document.getElementById('bulk-textarea').value =
`Ram Sharma, 101, BSc Agriculture, 9876543210
Shyam Patel, 102, MSc Agriculture, 9876543211
Geeta Verma, 103, BSc Agriculture, 9000000001
Mohan Lal, 104, BSc, 8900000001
Sunita Devi, 105, MSc, 7800000001`;
}
function clearBulkText() { document.getElementById('bulk-textarea').value=''; }
function downloadBulkTemplate() {
  const csv='Name,Room,Course,Phone\nRam Sharma,101,BSc Agriculture,9876543210\n';
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='student_import_template.csv'; a.click();
}
function parseBulk() {
  const raw=document.getElementById('bulk-textarea').value.trim();
  if(!raw){toast('Please paste student data first','warning');return;}
  const lines=raw.split('\n').filter(l=>l.trim());
  bulkParsedStudents=[];
  for(const line of lines){
    const ll=line.toLowerCase().trim();
    if(!ll||ll.startsWith('name')||ll.startsWith('#')||ll.startsWith('sr')) continue;
    const parts=line.includes('\t')?line.split('\t').map(p=>p.trim()):line.split(',').map(p=>p.trim());
    const name=parts[0]||''; if(!name) continue;
    bulkParsedStudents.push({name,room:parts[1]||'',course:parts[2]||'',phone:parts[3]||''});
  }
  if(bulkParsedStudents.length===0){toast('No valid data found!','error');return;}
  document.getElementById('bulk-preview-count').textContent=bulkParsedStudents.length;
  const tbody=document.getElementById('bulk-preview-tbody');
  tbody.innerHTML=bulkParsedStudents.map((s,i)=>`
    <tr>
      <td style="color:var(--text2);">${i+1}</td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.name)}"   onchange="bulkParsedStudents[${i}].name=this.value"></td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.room)}"   onchange="bulkParsedStudents[${i}].room=this.value"></td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.course)}" onchange="bulkParsedStudents[${i}].course=this.value"></td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.phone)}"  onchange="bulkParsedStudents[${i}].phone=this.value"></td>
      <td><button class="btn btn-xs btn-danger" onclick="bulkParsedStudents.splice(${i},1);parseBulkFromParsed()">✕</button></td>
    </tr>`).join('');
  showBulkStep(2);
}
function parseBulkFromParsed(){
  document.getElementById('bulk-preview-count').textContent=bulkParsedStudents.length;
  const tbody=document.getElementById('bulk-preview-tbody');
  tbody.innerHTML=bulkParsedStudents.map((s,i)=>`
    <tr>
      <td style="color:var(--text2);">${i+1}</td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.name)}"   onchange="bulkParsedStudents[${i}].name=this.value"></td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.room)}"   onchange="bulkParsedStudents[${i}].room=this.value"></td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.course)}" onchange="bulkParsedStudents[${i}].course=this.value"></td>
      <td><input class="form-control" style="padding:4px 8px;font-size:12px;" value="${esc(s.phone)}"  onchange="bulkParsedStudents[${i}].phone=this.value"></td>
      <td><button class="btn btn-xs btn-danger" onclick="bulkParsedStudents.splice(${i},1);parseBulkFromParsed()">✕</button></td>
    </tr>`).join('');
}
async function submitBulkImport(){
  if(!bulkParsedStudents.length){toast('No students to import','warning');return;}
  const btn=document.getElementById('bulk-import-btn');
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Importing...';
  try{
    const res=await fetch('/api/admin/students/bulk-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({students:bulkParsedStudents})});
    const data=await res.json();
    if(res.ok&&data.success){
      bulkImportResults=data.students||[];
      document.getElementById('bulk-done-msg').textContent=`${data.count} student${data.count!==1?'s':''} imported successfully!`;
      const tbody=document.getElementById('bulk-result-tbody');
      tbody.innerHTML=bulkImportResults.map((s,i)=>`
        <tr>
          <td style="color:var(--text2);">${i+1}</td>
          <td style="font-weight:700;">${esc(s.name)}</td>
          <td>${esc(s.room)||'—'}</td>
          <td style="font-family:monospace;color:var(--accent);">${s.username}</td>
          <td style="font-family:monospace;font-weight:700;color:var(--success);">${s.password}</td>
        </tr>`).join('');
      toast(`${data.count} students imported!`,'success');
      showBulkStep(3);
    }else{toast(data.error||'Import failed','error');btn.disabled=false;btn.textContent='🚀 Import All';}
  }catch(e){toast('Network error: '+e.message,'error');btn.disabled=false;btn.textContent='🚀 Import All';}
}
function copyAllCreds(){
  if(!bulkImportResults.length)return;
  let text='Name\tRoom\tUsername\tPassword\n';
  bulkImportResults.forEach(s=>{text+=`${s.name}\t${s.room||''}\t${s.username}\t${s.password}\n`;});
  navigator.clipboard.writeText(text).then(()=>toast('Credentials copied!','success')).catch(()=>toast('Copy failed','warning'));
}
function downloadCreds(){
  if(!bulkImportResults.length)return;
  let csv='Name,Room,Course,Phone,Username,Password\n';
  bulkImportResults.forEach(s=>{csv+=`"${s.name}","${s.room||''}","${s.course||''}","${s.phone||''}","${s.username}","${s.password}"\n`;});
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`credentials_${todayIST()}.csv`; a.click();
  toast('CSV downloaded!','success');
}

/* PDF Report Exporters */
function exportStudentsPDF() {
  window.location.href = '/api/admin/reports/pdf?type=students';
  toast('Generating students details PDF...', 'info');
}

function exportAttendancePDF() {
  const date = document.getElementById('att-date').value || todayIST();
  window.location.href = `/api/admin/reports/pdf?type=attendance&date=${date}`;
  toast(`Generating attendance PDF for ${date}...`, 'info');
}

/* ── Init ────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', ()=>{
  loadTheme();
  setTopbar();
  const today = todayIST();
  document.getElementById('att-date').value = today;
  document.getElementById('gate-date').value = today;
  document.getElementById('month-select').value = today.slice(0,7);
  _updateWizardUI();
  loadDashboard();
  setInterval(loadDashboard, 60000);
  setInterval(setTopbar, 30000);
});
