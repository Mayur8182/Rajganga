/* ── student.js ── Student portal logic ── */

/* ── Toast ────────────────────────────────────── */
function toast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span style="flex:1;">${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>t.remove(), 5000);
}

/* ── Theme ────────────────────────────────────── */
function toggleTheme() {
  const html  = document.documentElement;
  const dark  = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('theme', dark ? 'light' : 'dark');
  const btn = document.querySelector('.theme-toggle');
  if(btn) btn.textContent = dark ? '☀️' : '🌙';
}
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.querySelector('.theme-toggle');
  if(btn) btn.textContent = saved === 'dark' ? '🌙' : '☀️';
}

/* ── Modal ────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ── Section Nav ──────────────────────────────── */
function showStudentSection(name) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.s-nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(`s-section-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');
  if(name==='home')       loadHome();
  if(name==='attendance') loadCalendar();
  if(name==='gate')       loadGateTimeline();
  if(name==='leave')      loadMyLeaves();
  if(name==='profile')    loadProfile();
}

/* ── Helpers ──────────────────────────────────── */
function todayIST()        { return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}); }
function currentMonthIST() { return todayIST().slice(0,7); }
function fmtDT(iso) {
  if(!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }
  catch { return iso; }
}
function esc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Geolocation ──────────────────────────────── */
function getLocation() {
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error('Geolocation not supported by this device.'));return;}
    navigator.geolocation.getCurrentPosition(
      pos => {
        // Enforce strict high accuracy threshold (within 50m) to prevent mock locations or location errors
        if(pos.coords.accuracy && pos.coords.accuracy > 50) {
          reject(new Error(`Location accuracy too poor (${Math.round(pos.coords.accuracy)}m). Please step outside or enable GPS/Wi-Fi.`));
          return;
        }
        resolve({lat:pos.coords.latitude, lon:pos.coords.longitude});
      },
      err=>{
        const msgs={
          1:'Location permission denied. Please enable location access in your browser settings to verify you are at the hostel.',
          2:'Location unavailable. Please make sure your GPS is turned on.',
          3:'Location request timed out. Please try again.'
        };
        reject(new Error(msgs[err.code]||err.message));
      },
      {enableHighAccuracy:true, timeout:12000, maximumAge:0}
    );
  });
}

/* ── Home ─────────────────────────────────────── */
let currentGateStatus = 'in';

async function loadHome() {
  try {
    const [sRes,gRes] = await Promise.all([fetch('/api/student/stats'),fetch('/api/student/gate-status')]);
    const stats = await sRes.json();
    const gate  = await gRes.json();
    currentGateStatus = gate.status||'in';

    // Attendance status
    const attIcon = document.getElementById('att-status-icon');
    const attText = document.getElementById('att-status-text');
    const attSub  = document.getElementById('att-status-sub');
    const markBtn = document.getElementById('mark-att-btn');

    if(stats.today_status==='present') {
      attIcon.textContent='✅'; attText.textContent='Attendance Marked!';
      attText.style.color='var(--success)'; attSub.textContent='You are marked present for today.';
      markBtn.className='big-action-btn already-marked'; markBtn.onclick=null;
      document.getElementById('mark-att-icon').textContent='✅';
      document.getElementById('mark-att-text').textContent='Attendance Already Marked';
    } else if(stats.today_status==='leave') {
      attIcon.textContent='🏖️'; attText.textContent='On Approved Leave';
      attText.style.color='var(--info)'; attSub.textContent='You are on approved leave today.';
      markBtn.className='big-action-btn already-marked'; markBtn.onclick=null;
      document.getElementById('mark-att-icon').textContent='🏖️';
      document.getElementById('mark-att-text').textContent='On Approved Leave';
    } else {
      attIcon.textContent='⏰'; attText.textContent='Attendance Pending';
      attText.style.color='var(--warning)'; attSub.textContent='Mark your attendance before cutoff time.';
      markBtn.className='big-action-btn mark-present'; markBtn.onclick=markAttendance;
      document.getElementById('mark-att-icon').textContent='✅';
      document.getElementById('mark-att-text').textContent='Mark Today\'s Attendance';
    }

    // Stats
    document.getElementById('qs-present').textContent = stats.month_present||0;
    document.getElementById('qs-leave').textContent   = stats.month_leave||0;
    const days = new Date().getDate();
    const pct  = days>0?Math.round(((stats.month_present||0)/days)*100):0;
    document.getElementById('qs-pct').textContent = pct+'%';

    // Gate
    updateGateUI(gate);
  } catch(e) { console.error('Home error',e); }
}

function updateGateUI(gate) {
  const banner = document.getElementById('gate-banner');
  const title  = document.getElementById('gate-banner-title');
  const sub    = document.getElementById('gate-banner-sub');
  const outBtn = document.getElementById('gate-out-btn');
  const inBtn  = document.getElementById('gate-in-btn');
  const badge  = document.getElementById('gate-status-badge');

  if(gate.status==='out') {
    banner.className='gate-banner out';
    title.textContent='🚪 Outside Hostel';
    sub.textContent=gate.last_time?`Left at: ${gate.last_time}`:'You are currently outside';
    outBtn.disabled=true; outBtn.style.opacity='0.4';
    inBtn.disabled=false;  inBtn.style.opacity='1';
    if(badge){badge.className='badge badge-out';badge.textContent='🚪 Outside';}
  } else {
    banner.className='gate-banner in';
    title.textContent='🏠 Inside Hostel';
    sub.textContent=gate.last_time?`Returned at: ${gate.last_time}`:'You are currently inside';
    outBtn.disabled=false; outBtn.style.opacity='1';
    inBtn.disabled=true;   inBtn.style.opacity='0.4';
    if(badge){badge.className='badge badge-in';badge.textContent='🏠 Inside';}
  }
}

/* ── Mark Attendance ──────────────────────────── */
async function markAttendance() {
  const btn  = document.getElementById('mark-att-btn');
  const icon = document.getElementById('mark-att-icon');
  const txt  = document.getElementById('mark-att-text');
  btn.disabled=true; icon.textContent='📡'; txt.textContent='Getting location...';

  try {
    const coords = await getLocation();
    icon.textContent='⏳'; txt.textContent='Marking attendance...';
    const res  = await fetch('/api/student/attendance/mark',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({lat:coords.lat,lon:coords.lon})
    });
    const data = await res.json();
    if(res.ok) { toast(data.message,'success'); loadHome(); }
    else if(data.outside) { toast(data.error,'error'); btn.disabled=false; icon.textContent='✅'; txt.textContent='Mark Today\'s Attendance'; }
    else if(data.already_marked) { toast(data.error,'warning'); loadHome(); }
    else { toast(data.error||'Failed','error'); btn.disabled=false; icon.textContent='✅'; txt.textContent='Mark Today\'s Attendance'; }
  } catch(e) {
    toast(e.message,'error');
    btn.disabled=false; icon.textContent='✅'; txt.textContent='Mark Today\'s Attendance';
  }
}

/* ── Gate ─────────────────────────────────────── */
function openGateOut() {
  if(currentGateStatus==='out'){toast('You are already outside. Mark IN on return.','warning');return;}
  openModal('gate-out-modal');
}
async function doGateOut() {
  const reason=(document.getElementById('gate-reason').value||'').trim();
  if(!reason){toast('Please enter a reason','warning');return;}
  await doGateAction('out',reason);
  closeModal('gate-out-modal');
  document.getElementById('gate-reason').value='';
}
async function doGateIn() {
  if(currentGateStatus==='in'){toast('You are already inside.','warning');return;}
  await doGateAction('in','');
}

async function doGateAction(action, reason) {
  const outBtn=document.getElementById('gate-out-btn');
  const inBtn =document.getElementById('gate-in-btn');
  outBtn.disabled=true; inBtn.disabled=true;
  try {
    const coords = await getLocation();
    const res    = await fetch('/api/gate',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,reason,lat:coords.lat,lon:coords.lon})
    });
    const data = await res.json();
    if(res.ok) {
      toast(data.message,'success');
      currentGateStatus = action==='out'?'out':'in';
      updateGateUI({status:currentGateStatus, last_time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})});
    } else if(data.outside) {
      toast(data.error,'error');
    } else {
      toast(data.error||'Gate action failed','error');
    }
  } catch(e) {
    toast(e.message,'error');
  } finally {
    outBtn.disabled=false; inBtn.disabled=false;
    setTimeout(loadHome, 600);
  }
}

/* ── Calendar ─────────────────────────────────── */
async function loadCalendar() {
  const monthEl = document.getElementById('cal-month');
  const month   = monthEl.value || currentMonthIST();
  if(!monthEl.value) monthEl.value=month;
  const [year,mon]=month.split('-').map(Number);
  const today=todayIST();
  try {
    const res     = await fetch(`/api/student/attendance?month=${month}`);
    const records = await res.json();
    const attMap  = {};
    records.forEach(r=>{attMap[r.date]=r.status;});

    const dayHdrEl=document.getElementById('cal-day-headers');
    dayHdrEl.innerHTML=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-day-header">${d}</div>`).join('');

    const firstDay=new Date(year,mon-1,1).getDay();
    const daysInMon=new Date(year,mon,0).getDate();
    const gridEl=document.getElementById('cal-grid');
    let cells='';
    for(let i=0;i<firstDay;i++) cells+='<div class="cal-day empty"></div>';
    let p=0,a=0,l=0;
    for(let d=1;d<=daysInMon;d++){
      const ds=`${month}-${String(d).padStart(2,'0')}`;
      const status=attMap[ds];
      const isToday=ds===today, isFuture=ds>today;
      let cls='cal-day';
      if(isToday) cls+=' today';
      if(isFuture) cls+=' future';
      else if(status==='present'){cls+=' present';p++;}
      else if(status==='leave'){cls+=' leave';l++;}
      else if(!isFuture){cls+=' absent';if(!isToday)a++;}
      cells+=`<div class="${cls}">${d}</div>`;
    }
    gridEl.innerHTML=cells;
    document.getElementById('cal-present-cnt').textContent=p;
    document.getElementById('cal-absent-cnt').textContent=a;
    document.getElementById('cal-leave-cnt').textContent=l;
  } catch(e){console.error('Calendar error',e);}
}

/* ── Gate Timeline ────────────────────────────── */
async function loadGateTimeline() {
  const tl=document.getElementById('gate-timeline');
  tl.innerHTML='<div class="spinner-center"><div class="loader"></div></div>';
  try {
    const res =await fetch('/api/student/gate-logs');
    const logs=await res.json();
    if(logs.length===0){
      tl.innerHTML='<div class="empty-state"><div class="icon">🚪</div><p>No gate log entries yet.</p></div>';
      return;
    }
    tl.innerHTML=`<div class="timeline">${logs.map(l=>`
      <div class="tl-item">
        <div class="tl-dot ${l.action}"></div>
        <div class="tl-content">
          <div class="tl-time">${fmtDT(l.timestamp)}</div>
          <div class="tl-action">${l.action==='out'?'🚪 Went OUT of hostel':'🏠 Returned IN to hostel'}</div>
          ${l.reason?`<div class="tl-reason">📝 Reason: ${esc(l.reason)}</div>`:''}
          ${l.return_time&&l.action==='out'?`<div class="tl-reason" style="color:var(--success);">✅ Returned: ${fmtDT(l.return_time)}</div>`:''}
          ${l.action==='out'&&!l.return_time?`<div class="tl-reason" style="color:var(--warning);">⏳ Still outside</div>`:''}
        </div>
      </div>`).join('')}</div>`;
  } catch(e){tl.innerHTML='<div class="empty-state"><p>Error loading gate log</p></div>';}
}

/* ── Leaves ───────────────────────────────────── */
async function loadMyLeaves() {
  const el=document.getElementById('my-leaves-list');
  el.innerHTML='<div class="spinner-center"><div class="loader"></div></div>';
  try {
    const res   =await fetch('/api/student/leaves');
    const leaves=await res.json();
    if(leaves.length===0){
      el.innerHTML=`<div class="card"><div class="empty-state">
        <div class="icon">🏖️</div><p>No leave applications yet.</p>
        <button class="btn btn-primary" style="margin-top:14px;" onclick="openModal('leave-modal')">Apply for Leave</button>
      </div></div>`;
      return;
    }
    el.innerHTML=leaves.map(l=>`
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">📅 ${l.from_date} → ${l.to_date}</div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:6px;">${esc(l.reason)}</div>
            <div style="font-size:11px;color:var(--text3);">Applied: ${fmtDT(l.created_at)}</div>
            ${l.reviewed_by?`<div style="font-size:11px;color:var(--text3);">Reviewed by: ${l.reviewed_by}</div>`:''}
          </div>
          <span class="badge badge-${l.status}" style="flex-shrink:0;">${l.status.toUpperCase()}</span>
        </div>
      </div>`).join('');
  } catch(e){el.innerHTML='<div class="empty-state"><p>Error loading leaves</p></div>';}
}

async function submitLeave() {
  const from  =(document.getElementById('leave-from').value||'').trim();
  const to    =(document.getElementById('leave-to').value||'').trim();
  const reason=(document.getElementById('leave-reason').value||'').trim();
  if(!from||!to||!reason){toast('All fields are required','warning');return;}
  if(from>to){toast('From date cannot be after To date','warning');return;}
  try {
    const res =await fetch('/api/student/leaves',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from_date:from,to_date:to,reason})});
    const data=await res.json();
    if(res.ok){
      toast(data.message,'success');
      closeModal('leave-modal');
      document.getElementById('leave-from').value='';
      document.getElementById('leave-to').value='';
      document.getElementById('leave-reason').value='';
      loadMyLeaves();
    } else toast(data.error||'Failed','error');
  } catch(e){toast('Network error!','error');}
}

/* ── Profile ──────────────────────────────────── */
async function loadProfile() {
  try {
    const res =await fetch('/api/me');
    const user=await res.json();

    document.getElementById('profile-name').textContent          = user.name||'—';
    document.getElementById('profile-username-badge').textContent= user.username||'—';
    document.getElementById('profile-course').textContent        = user.course||'—';
    document.getElementById('profile-room').textContent          = user.room||'—';
    document.getElementById('profile-year').textContent          = user.year||'—';
    document.getElementById('profile-roll').textContent          = user.roll_number||'—';
    document.getElementById('profile-email').textContent         = user.email||'—';
    document.getElementById('profile-phone').textContent         = user.phone||'—';
    document.getElementById('profile-college').textContent       = user.college||'—';
    document.getElementById('profile-hostel').textContent        = user.hostel_number||'—';
    document.getElementById('profile-village').textContent       = user.village||'—';
    document.getElementById('profile-username').textContent      = user.username||'—';

    // Populate extra fields
    const extraContainer = document.getElementById('profile-extra-fields-container');
    if (extraContainer) {
      extraContainer.innerHTML = '';
      if (user.extra_fields) {
        for (const [key, val] of Object.entries(user.extra_fields)) {
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.padding = '12px';
          div.style.background = 'var(--bg3)';
          div.style.borderRadius = '10px';
          div.innerHTML = `
            <span style="font-size:12px;color:var(--text2);">${esc(key)}</span>
            <span style="font-size:13px;font-weight:600;">${esc(val)}</span>
          `;
          extraContainer.appendChild(div);
        }
      }
    }

    const init=(user.name||'?')[0].toUpperCase();
    document.getElementById('profile-initials-big').textContent  = init;

    if(user.photo){
      document.getElementById('profile-photo-wrap-big').innerHTML=`<img src="${user.photo}" class="profile-photo-big" style="width:88px;height:88px;margin:0 auto;display:block;" alt="${user.name}">`;
    }
  } catch(e){console.error('Profile error',e);}
}

/* ── Logout ───────────────────────────────────── */
async function doLogout() {
  await fetch('/api/logout',{method:'POST'});
  window.location.href='/';
}

/* ── Topbar update ────────────────────────────── */
async function updateTopbar() {
  try {
    const res =await fetch('/api/student/gate-status');
    const gate=await res.json();
    currentGateStatus=gate.status||'in';
    const badge=document.getElementById('gate-status-badge');
    if(badge){
      badge.className=`badge badge-${gate.status==='out'?'out':'in'}`;
      badge.textContent=gate.status==='out'?'🚪 Outside':'🏠 Inside';
    }
  } catch(e){}
}

/* ── Profile Header (top of page) ────────────── */
async function loadProfileHeader() {
  try {
    const res =await fetch('/api/me');
    const user=await res.json();
    document.getElementById('student-name-top').textContent = user.name||'';
    const init=(user.name||'?')[0].toUpperCase();
    document.getElementById('profile-name-top').textContent  = user.name||'—';
    document.getElementById('profile-initials').textContent  = init;

    // Sub title
    const parts=[user.course,user.year,user.college].filter(Boolean);
    document.getElementById('profile-sub-top').textContent = parts.join(' · ') || '';

    // Tags row
    const tags=document.getElementById('profile-tags-top');
    const tagItems=[
      user.hostel_number && `<span class="tag info">🏠 ${user.hostel_number}</span>`,
      user.room          && `<span class="tag">🚪 Room ${user.room}</span>`,
      user.village       && `<span class="tag">🏡 ${user.village}</span>`,
    ].filter(Boolean).join('');
    if(tags) tags.innerHTML=tagItems;

    if(user.photo){
      document.getElementById('profile-photo-wrap').innerHTML=`<img src="${user.photo}" class="profile-photo-big" alt="${user.name}">`;
    }
  } catch(e){}
}

/* ── Init ─────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async ()=>{
  loadTheme();
  const today=todayIST();
  document.getElementById('leave-from').value=today;
  document.getElementById('leave-to').value=today;
  document.getElementById('leave-from').min=today;
  document.getElementById('leave-to').min=today;

  await loadProfileHeader();
  loadHome();
  updateTopbar();

  setInterval(()=>{loadHome();updateTopbar();}, 90000);
});
