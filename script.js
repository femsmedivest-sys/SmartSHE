/* ==========================================================================
   SMARTSHE — Medivest Digital Training System (MDTS)
   Client-side reference implementation of the requirement document:
     - AD login (simulated SSO — swap `authenticateAD()` for a real
       OAuth/AD redirect + token exchange in production)
     - Event QR generation
     - 2-stage attendance: Staff scan (PENDING_VERIFICATION) -> Trainer
       verification (VERIFIED)
     - Certification upload + expiry monitoring (30d / 7d / expired)
     - Dashboard, staff directory, reporting (CSV export)
   Persistence: localStorage (drop-in swap point for a real API — see
   the DB object below, every call is already async-shaped).
   ========================================================================== */

(() => {
"use strict";

/* ==========================================================================
   0. MOCK ACTIVE DIRECTORY
   In production this list is replaced entirely by an AD/OIDC call.
   ========================================================================== */
const AD_DIRECTORY = [
  { email: "ahmad.taufek@medivest.com",  name: "Ahmad Taufek Abas Seram", department: "C-QSR",       position: "System Admin",      role: "admin"   },
  { email: "siti.rahman@medivest.com",   name: "Siti Rahman",             department: "SHE",          position: "Senior Trainer",    role: "trainer" },
  { email: "daniel.wong@medivest.com",   name: "Daniel Wong",             department: "Engineering",  position: "Safety Trainer",    role: "trainer" },
  { email: "nur.aisyah@medivest.com",    name: "Nur Aisyah Kamal",        department: "Production",   position: "Line Operator",     role: "staff"   },
  { email: "farid.hassan@medivest.com",  name: "Farid Hassan",            department: "Warehouse",    position: "Store Keeper",      role: "staff"   },
  { email: "lim.wei.jie@medivest.com",   name: "Lim Wei Jie",             department: "Maintenance",  position: "Technician",        role: "staff"   },
  { email: "priya.kumar@medivest.com",   name: "Priya Kumar",             department: "QA",           position: "QA Inspector",      role: "staff"   },
  { email: "hafiz.rosli@medivest.com",   name: "Hafiz Rosli",             department: "Production",   position: "Shift Supervisor",  role: "staff"   },
];

/* ==========================================================================
   1. PERSISTENCE LAYER
   ========================================================================== */
const DB_KEY = "smartshe_db_v1";
const SESSION_KEY = "smartshe_session_v1";

const DB = {
  read(){
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  write(data){
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  },
  seedIfEmpty(){
    if (this.read()) return;
    const staff = AD_DIRECTORY.map((u, i) => ({
      id: "stf_" + (i+1),
      ...u,
      healthCondition: "None declared",
      certifications: []
    }));

    // seed a couple of certifications so the expiry system has data to show
    const today = new Date();
    const addDays = (d) => { const t = new Date(today); t.setDate(t.getDate()+d); return t.toISOString().slice(0,10); };
    staff[3].certifications.push({ id: "cert_1", name: "First Aider", issuedBy: "St. John Ambulance", issuedDate: "2024-01-10", expiryDate: addDays(5),  fileName: "first-aider-cert.pdf", fileData: null });
    staff[4].certifications.push({ id: "cert_2", name: "Forklift License", issuedBy: "DOSH", issuedDate: "2023-11-02", expiryDate: addDays(25), fileName: "forklift-license.pdf", fileData: null });
    staff[5].certifications.push({ id: "cert_3", name: "Confined Space Entry", issuedBy: "NIOSH", issuedDate: "2023-06-01", expiryDate: addDays(-3), fileName: "cse-cert.pdf", fileData: null });
    staff[6].certifications.push({ id: "cert_4", name: "Safety Induction", issuedBy: "Medivest SHE", issuedDate: "2024-03-01", expiryDate: addDays(120), fileName: "induction.pdf", fileData: null });

    const events = [
      {
        id: "evt_1", title: "Fire Safety & Emergency Response",
        date: addDays(-1), location: "Training Hall A", trainerId: "stf_2",
        qrToken: "SMARTSHE-EVENT-evt_1-" + Math.random().toString(36).slice(2,8),
        status: "ACTIVE", createdAt: new Date().toISOString()
      },
      {
        id: "evt_2", title: "Confined Space Entry Refresher",
        date: addDays(2), location: "Plant Site - Bay 3", trainerId: "stf_3",
        qrToken: "SMARTSHE-EVENT-evt_2-" + Math.random().toString(36).slice(2,8),
        status: "ACTIVE", createdAt: new Date().toISOString()
      }
    ];

    const attendance = [
      { id: "att_1", eventId: "evt_1", staffId: "stf_4", scannedAt: new Date().toISOString(), scannedBy: "stf_4", attendanceStatus: "VERIFIED", verifiedBy: "stf_2", verifiedAt: new Date().toISOString(), notes: "" },
      { id: "att_2", eventId: "evt_1", staffId: "stf_5", scannedAt: new Date().toISOString(), scannedBy: "stf_5", attendanceStatus: "PENDING_VERIFICATION", verifiedBy: null, verifiedAt: null, notes: "" },
    ];

    this.write({ staff, events, attendance });
  },
  getStaff(){ return this.read().staff; },
  getEvents(){ return this.read().events; },
  getAttendance(){ return this.read().attendance; },
  saveAll(data){ this.write(data); },
};

DB.seedIfEmpty();

/* ==========================================================================
   2. SESSION / AUTH  (simulated AD SSO)
   ========================================================================== */
function authenticateAD(email){
  const clean = (email || "").trim().toLowerCase();
  const match = AD_DIRECTORY.find(u => u.email.toLowerCase() === clean);
  if (!match) return null;
  const db = DB.read();
  const staffRecord = db.staff.find(s => s.email.toLowerCase() === clean);
  return staffRecord || null;
}

function getSession(){
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}
function setSession(staffId){ sessionStorage.setItem(SESSION_KEY, JSON.stringify({ staffId, tokenId: "TKN-" + uid() })); }
function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }

function currentUser(){
  const s = getSession();
  if (!s) return null;
  return DB.read().staff.find(x => x.id === s.staffId) || null;
}

/* ==========================================================================
   3. UTILITIES
   ========================================================================== */
function uid(){ return Math.random().toString(36).slice(2,10); }
function initials(name){ return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); }
function fmtDate(d){ if(!d) return "—"; return new Date(d).toLocaleDateString("en-MY",{day:"2-digit",month:"short",year:"numeric"}); }
function fmtDateTime(d){ if(!d) return "—"; return new Date(d).toLocaleString("en-MY",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
function daysBetween(dateStr){
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.round((target - now) / 86400000);
}
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function toast(msg, type="default"){
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition="opacity .25s"; setTimeout(()=>el.remove(), 250); }, 3200);
}

function openModal(html){
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop" data-close="1"></div><div class="modal-box">${html}</div>`;
  root.classList.remove("hidden");
  root.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  root.querySelectorAll("[data-modal-close]").forEach(b => b.addEventListener("click", closeModal));
}
function closeModal(){
  stopScanner();
  document.getElementById("modalRoot").classList.add("hidden");
  document.getElementById("modalRoot").innerHTML = "";
}

/* Certification expiry classification per requirement doc:
   30 days -> reminder, 7 days -> urgent reminder, past -> non-compliance flag */
function certStatus(expiryDate){
  const d = daysBetween(expiryDate);
  if (d < 0)  return { level:"EXPIRED", label:"Expired", days:d, cls:"red" };
  if (d <= 7) return { level:"URGENT",  label:`Urgent · ${d}d left`, days:d, cls:"red" };
  if (d <= 30) return { level:"REMINDER", label:`Reminder · ${d}d left`, days:d, cls:"amber" };
  return { level:"OK", label:`Valid · ${d}d left`, days:d, cls:"green" };
}

/* ==========================================================================
   4. ROUTER
   ========================================================================== */
const VIEWS = ["dashboard","events","attendance","certifications","staff","reports"];
const VIEW_TITLES = {
  dashboard: "Dashboard", events: "Training Events", attendance: "Attendance",
  certifications: "Certifications", staff: "Staff Directory", reports: "Reports"
};
const RENDERERS = {}; // filled below

function showView(name){
  if (!VIEWS.includes(name)) name = "dashboard";
  VIEWS.forEach(v => document.getElementById("view-"+v).classList.toggle("hidden", v !== name));
  document.querySelectorAll(".nav-item[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.getElementById("viewTitle").textContent = VIEW_TITLES[name];
  document.getElementById("mainNav").parentElement?.classList.remove("open");
  document.querySelector(".sidebar").classList.remove("open");
  RENDERERS[name]?.();
  location.hash = name;
}

/* ==========================================================================
   5. NAVIGATION VISIBILITY BY ROLE
   ========================================================================== */
function applyRoleVisibility(){
  const u = currentUser();
  if (!u) return;
  document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
    const view = btn.dataset.view;
    if (view === "staff" && u.role !== "admin") btn.classList.add("hidden");
    else if (view === "reports" && u.role === "staff") btn.classList.add("hidden");
    else btn.classList.remove("hidden");
  });
}

/* ==========================================================================
   6. TOP BAR: user chip + notifications
   ========================================================================== */
function renderUserChip(){
  const u = currentUser();
  if (!u) return;
  document.getElementById("userAvatar").textContent = initials(u.name);
  document.getElementById("userName").textContent = u.name;
  document.getElementById("userRole").textContent = u.role;
}

function computeNotifications(){
  const u = currentUser();
  const db = DB.read();
  const notes = [];

  if (u.role === "staff"){
    (u.certifications||[]).forEach(c => {
      const st = certStatus(c.expiryDate);
      if (st.level !== "OK") notes.push({ level: st.level, title: c.name, text: st.level==="EXPIRED" ? `Expired ${Math.abs(st.days)}d ago — non-compliant` : `Expires in ${st.days} day(s)` });
    });
  }
  if (u.role === "trainer"){
    const myEvents = db.events.filter(e => e.trainerId === u.id).map(e=>e.id);
    const pending = db.attendance.filter(a => myEvents.includes(a.eventId) && a.attendanceStatus === "PENDING_VERIFICATION");
    pending.forEach(a => {
      const s = db.staff.find(x=>x.id===a.staffId);
      const e = db.events.find(x=>x.id===a.eventId);
      notes.push({ level:"REMINDER", title:"Verification pending", text:`${s?.name||"Staff"} — ${e?.title||"Event"}` });
    });
  }
  if (u.role === "admin"){
    db.staff.forEach(s => (s.certifications||[]).forEach(c => {
      const st = certStatus(c.expiryDate);
      if (st.level === "URGENT" || st.level === "EXPIRED") notes.push({ level: st.level, title: `${s.name} — ${c.name}`, text: st.level==="EXPIRED" ? "Expired — flagged non-compliant" : `Expires in ${st.days} day(s)` });
    }));
    const pending = db.attendance.filter(a => a.attendanceStatus === "PENDING_VERIFICATION");
    if (pending.length) notes.push({ level:"REMINDER", title:"Attendance awaiting verification", text:`${pending.length} record(s) pending trainer approval` });
  }
  return notes;
}

function renderNotifications(){
  const notes = computeNotifications();
  const btn = document.getElementById("notifCount");
  if (notes.length){ btn.textContent = notes.length; btn.classList.remove("hidden"); } else btn.classList.add("hidden");

  const panel = document.getElementById("notifPanel");
  if (!notes.length){
    panel.innerHTML = `<div class="notif-empty">No alerts right now. All caught up.</div>`;
    return;
  }
  panel.innerHTML = notes.map(n => `
    <div class="notif-item">
      <span class="notif-dot" style="background:var(--${n.level==='EXPIRED'||n.level==='URGENT'?'red':n.level==='REMINDER'?'amber':'green'})"></span>
      <div class="notif-text"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.text)}</span></div>
    </div>`).join("");
}

/* ==========================================================================
   7. DASHBOARD
   ========================================================================== */
RENDERERS.dashboard = function(){
  const u = currentUser();
  const db = DB.read();
  const el = document.getElementById("view-dashboard");

  const visibleEvents = u.role === "admin" ? db.events : u.role === "trainer" ? db.events.filter(e=>e.trainerId===u.id) : db.events;
  const visibleAttendance = u.role === "admin" ? db.attendance
    : u.role === "trainer" ? db.attendance.filter(a => visibleEvents.some(e=>e.id===a.eventId))
    : db.attendance.filter(a => a.staffId === u.id);

  const verified = visibleAttendance.filter(a=>a.attendanceStatus==="VERIFIED").length;
  const pending = visibleAttendance.filter(a=>a.attendanceStatus==="PENDING_VERIFICATION").length;
  const activeEvents = visibleEvents.filter(e=>e.status==="ACTIVE").length;

  const certPool = u.role === "staff" ? (u.certifications||[]) : db.staff.flatMap(s=>(s.certifications||[]).map(c=>({...c, staffName:s.name})));
  const expiring = certPool.filter(c => { const s = certStatus(c.expiryDate); return s.level==="URGENT"||s.level==="REMINDER"; }).length;
  const expired = certPool.filter(c => certStatus(c.expiryDate).level==="EXPIRED").length;

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Welcome back, ${escapeHtml(u.name.split(" ")[0])}</h2>
        <p>Real-time snapshot of attendance verification and certification compliance across ${u.role === 'admin' ? 'the organization' : u.role === 'trainer' ? 'your assigned events' : 'your training record'}.</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card accent-orange">
        <div class="stat-label">Active Events</div>
        <div class="stat-value">${activeEvents}</div>
        <div class="stat-sub">${visibleEvents.length} total in scope</div>
      </div>
      <div class="stat-card accent-green">
        <div class="stat-label">Verified Attendance</div>
        <div class="stat-value">${verified}</div>
        <div class="stat-sub">Confirmed by trainer</div>
      </div>
      <div class="stat-card accent-amber">
        <div class="stat-label">Pending Verification</div>
        <div class="stat-value">${pending}</div>
        <div class="stat-sub">Awaiting stage-2 approval</div>
      </div>
      <div class="stat-card accent-red">
        <div class="stat-label">Compliance Alerts</div>
        <div class="stat-value">${expiring + expired}</div>
        <div class="stat-sub">${expired} expired · ${expiring} expiring soon</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h3>Attendance integrity</h3>
        <span class="tag-count">Rule: staff scan alone is not valid — trainer verification required</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Condition</th><th>Result</th></tr></thead>
          <tbody>
            <tr><td>Staff scan only (Stage 1)</td><td><span class="badge red">✕ Not valid attendance</span></td></tr>
            <tr><td>Trainer verification completed (Stage 2)</td><td><span class="badge green">✓ Valid attendance</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h3>Upcoming / recent events</h3>
        <button class="btn btn-ghost btn-sm" data-goto="events">View all</button>
      </div>
      ${visibleEvents.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Event</th><th>Date</th><th>Location</th><th>Trainer</th><th>Status</th></tr></thead>
          <tbody>
          ${visibleEvents.slice(0,5).map(e => {
            const trainer = db.staff.find(s=>s.id===e.trainerId);
            return `<tr>
              <td class="cell-strong">${escapeHtml(e.title)}</td>
              <td class="mono cell-dim">${fmtDate(e.date)}</td>
              <td class="cell-dim">${escapeHtml(e.location)}</td>
              <td class="cell-dim">${trainer?escapeHtml(trainer.name):"—"}</td>
              <td>${e.status==="ACTIVE" ? '<span class="badge green">Active</span>' : '<span class="badge gray">Closed</span>'}</td>
            </tr>`;
          }).join("")}
          </tbody>
        </table>
      </div>` : emptyState("No events yet", "Create a training event to generate a QR code for attendance.")}
    </div>
  `;
  el.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => showView(b.dataset.goto)));
};

function emptyState(title, sub){
  return `<div class="empty-state"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(sub)}</p></div>`;
}

/* ==========================================================================
   8. EVENTS  (create, QR generation, staff scan / check-in)
   ========================================================================== */
RENDERERS.events = function(){
  const u = currentUser();
  const db = DB.read();
  const el = document.getElementById("view-events");
  const isAdmin = u.role === "admin";
  const events = isAdmin ? db.events : u.role === "trainer" ? db.events.filter(e=>e.trainerId===u.id) : db.events;

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Training Events</h2>
        <p>Each event generates a unique QR code used by staff to self check-in, then confirmed by the assigned trainer.</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" id="btnNewEvent">+ New Event</button>` : ""}
    </div>
    <div class="grid-cards" id="eventsGrid"></div>
  `;

  const grid = el.querySelector("#eventsGrid");
  if (!events.length){ grid.innerHTML = emptyState("No events found", "Once an event is created its QR pass will appear here."); }
  else {
    grid.innerHTML = events.map(e => {
      const trainer = db.staff.find(s=>s.id===e.trainerId);
      const count = db.attendance.filter(a=>a.eventId===e.id);
      const verified = count.filter(a=>a.attendanceStatus==="VERIFIED").length;
      return `
      <div class="event-card">
        <div class="event-card-top">
          <span class="ev-status">${e.status==="ACTIVE" ? '<span class="badge green">Active</span>' : '<span class="badge gray">Closed</span>'}</span>
          <h4>${escapeHtml(e.title)}</h4>
          <div class="ev-meta">
            ${fmtDate(e.date)} &nbsp;·&nbsp; ${escapeHtml(e.location)}<br/>
            Trainer: ${trainer?escapeHtml(trainer.name):"Unassigned"}<br/>
            <span class="mono">${verified}/${count.length} verified</span>
          </div>
        </div>
        <div class="event-card-actions">
          <button class="btn btn-secondary btn-sm" data-qr="${e.id}">View QR</button>
          ${u.role === "staff" ? `<button class="btn btn-primary btn-sm" data-scan="${e.id}">Scan to Check-in</button>` : ""}
          ${isAdmin && e.status==="ACTIVE" ? `<button class="btn btn-ghost btn-sm" data-close="${e.id}">Close event</button>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  el.querySelector("#btnNewEvent")?.addEventListener("click", openCreateEventModal);
  grid.querySelectorAll("[data-qr]").forEach(b => b.addEventListener("click", () => openQrModal(b.dataset.qr)));
  grid.querySelectorAll("[data-scan]").forEach(b => b.addEventListener("click", () => openScanModal(b.dataset.scan)));
  grid.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => {
    const data = DB.read();
    const ev = data.events.find(x=>x.id===b.dataset.close);
    ev.status = "CLOSED";
    DB.saveAll(data);
    toast("Event closed", "warn");
    RENDERERS.events();
  }));
};

function openCreateEventModal(){
  const db = DB.read();
  const trainers = db.staff.filter(s=>s.role==="trainer");
  openModal(`
    <div class="modal-head">
      <div><h3>New Training Event</h3><p>A unique QR code will be generated on save.</p></div>
      <button class="modal-close" data-modal-close>&times;</button>
    </div>
    <div class="modal-body">
      <label class="field"><span>Event title</span><input id="fTitle" placeholder="e.g. Fire Safety & Emergency Response"/></label>
      <div class="form-row">
        <label class="field"><span>Date</span><input id="fDate" type="date"/></label>
        <label class="field"><span>Location</span><input id="fLocation" placeholder="Training Hall A"/></label>
      </div>
      <label class="field"><span>Assigned trainer</span>
        <select id="fTrainer">
          ${trainers.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-modal-close>Cancel</button>
      <button class="btn btn-primary" id="saveEventBtn">Create & generate QR</button>
    </div>
  `);
  document.getElementById("saveEventBtn").addEventListener("click", () => {
    const title = document.getElementById("fTitle").value.trim();
    const date = document.getElementById("fDate").value;
    const location = document.getElementById("fLocation").value.trim();
    const trainerId = document.getElementById("fTrainer").value;
    if (!title || !date || !location || !trainerId){ toast("Please fill in all fields", "error"); return; }

    const data = DB.read();
    const id = "evt_" + uid();
    data.events.push({
      id, title, date, location, trainerId,
      qrToken: `SMARTSHE-EVENT-${id}-${uid()}`,
      status: "ACTIVE", createdAt: new Date().toISOString()
    });
    DB.saveAll(data);
    toast("Event created", "success");
    closeModal();
    RENDERERS.events();
    openQrModal(id);
  });
}

function openQrModal(eventId){
  const db = DB.read();
  const e = db.events.find(x=>x.id===eventId);
  if (!e) return;
  openModal(`
    <div class="modal-head">
      <div><h3>${escapeHtml(e.title)}</h3><p>Distribute this QR to participants. Staff scan to check in; the trainer confirms attendance afterward.</p></div>
      <button class="modal-close" data-modal-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="qr-stage">
        <div id="qrCanvas"></div>
        <div class="qr-token">${escapeHtml(e.qrToken)}</div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-modal-close>Close</button>
    </div>
  `);
  // eslint-disable-next-line no-undef
  new QRCode(document.getElementById("qrCanvas"), {
    text: e.qrToken, width: 190, height: 190,
    colorDark: "#0B1420", colorLight: "#ffffff"
  });
}

/* ---- Staff self check-in (Stage 1) ---- */
let scannerInstance = null;
function stopScanner(){
  if (scannerInstance){
    scannerInstance.stop().then(()=>scannerInstance.clear()).catch(()=>{});
    scannerInstance = null;
  }
}

function openScanModal(eventId){
  const db = DB.read();
  const e = db.events.find(x=>x.id===eventId);
  const u = currentUser();
  const already = db.attendance.find(a=>a.eventId===eventId && a.staffId===u.id);

  openModal(`
    <div class="modal-head">
      <div><h3>Check in — ${escapeHtml(e.title)}</h3><p>Scan the event QR, or paste the code below if a camera isn't available.</p></div>
      <button class="modal-close" data-modal-close>&times;</button>
    </div>
    <div class="modal-body">
      ${already ? `<div class="field-error">You already checked in for this event — status: <strong>${already.attendanceStatus.replace("_"," ")}</strong>. Duplicate check-in is not allowed.</div>` : `
      <div id="scannerBox"></div>
      <div class="chip-row"><button class="chip" id="toggleManual">Use manual code entry instead</button></div>
      <div id="manualEntry" class="hidden">
        <label class="field"><span>QR code text</span><input id="manualToken" placeholder="Paste SMARTSHE-EVENT-... code"/></label>
        <button class="btn btn-primary btn-block" id="manualSubmit" style="margin-top:10px;">Submit check-in</button>
      </div>
      `}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-modal-close>Cancel</button>
    </div>
  `);

  if (already) return;

  document.getElementById("toggleManual").addEventListener("click", () => {
    stopScanner();
    document.getElementById("scannerBox").classList.add("hidden");
    document.getElementById("manualEntry").classList.remove("hidden");
  });
  document.getElementById("manualSubmit").addEventListener("click", () => {
    const token = document.getElementById("manualToken").value.trim();
    processCheckIn(eventId, token);
  });

  // Try camera scanning; fall back silently to manual entry if unavailable.
  try{
    // eslint-disable-next-line no-undef
    scannerInstance = new Html5Qrcode("scannerBox");
    scannerInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 210 },
      (decodedText) => { processCheckIn(eventId, decodedText); },
      () => {}
    ).catch(() => {
      document.getElementById("toggleManual")?.click();
    });
  }catch(err){
    document.getElementById("toggleManual")?.click();
  }
}

function processCheckIn(eventId, scannedToken){
  const data = DB.read();
  const e = data.events.find(x=>x.id===eventId);
  const u = currentUser();

  if (!e || e.status !== "ACTIVE"){ toast("Event is not active", "error"); return; }
  if (!scannedToken || scannedToken !== e.qrToken){ toast("QR code does not match this event", "error"); return; }
  if (data.attendance.some(a=>a.eventId===eventId && a.staffId===u.id)){ toast("Duplicate check-in blocked", "error"); return; }

  data.attendance.push({
    id: "att_" + uid(), eventId, staffId: u.id,
    scannedAt: new Date().toISOString(), scannedBy: u.id,
    attendanceStatus: "PENDING_VERIFICATION",
    verifiedBy: null, verifiedAt: null, notes: ""
  });
  DB.saveAll(data);
  stopScanner();
  closeModal();
  toast("Checked in — pending trainer verification", "success");
  renderNotifications();
  RENDERERS.attendance();
  RENDERERS.dashboard();
}

/* ==========================================================================
   9. ATTENDANCE  (Stage-2 trainer verification)
   ========================================================================== */
RENDERERS.attendance = function(){
  const u = currentUser();
  const db = DB.read();
  const el = document.getElementById("view-attendance");

  let rows = db.attendance.map(a => ({
    ...a,
    staff: db.staff.find(s=>s.id===a.staffId),
    event: db.events.find(e=>e.id===a.eventId),
  }));

  if (u.role === "trainer") rows = rows.filter(r => r.event && r.event.trainerId === u.id);
  if (u.role === "staff") rows = rows.filter(r => r.staffId === u.id);

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Attendance</h2>
        <p>Attendance is a two-stage process. Stage 1 (staff scan) is recorded as pending. Stage 2 (trainer verification) confirms it as valid.</p>
      </div>
      <div class="chip-row" id="attFilter">
        <button class="chip active" data-f="ALL">All</button>
        <button class="chip" data-f="PENDING_VERIFICATION">Pending</button>
        <button class="chip" data-f="VERIFIED">Verified</button>
      </div>
    </div>
    <div class="panel">
      <div class="table-wrap" id="attTableWrap"></div>
    </div>
  `;

  const canVerify = u.role === "trainer" || u.role === "admin";

  function draw(filter){
    const list = filter==="ALL" ? rows : rows.filter(r=>r.attendanceStatus===filter);
    const wrap = document.getElementById("attTableWrap");
    if (!list.length){ wrap.innerHTML = emptyState("No attendance records", "Records appear once staff scan an event QR code."); return; }
    wrap.innerHTML = `
      <table>
        <thead><tr>
          <th>Staff</th><th>Event</th><th>Scanned</th><th>Status</th><th>Verified by</th>${canVerify?"<th></th>":""}
        </tr></thead>
        <tbody>
        ${list.map(r => `
          <tr>
            <td class="cell-strong">${escapeHtml(r.staff?.name||"Unknown")}</td>
            <td class="cell-dim">${escapeHtml(r.event?.title||"—")}</td>
            <td class="mono cell-dim">${fmtDateTime(r.scannedAt)}</td>
            <td>${r.attendanceStatus==="VERIFIED" ? '<span class="badge green">Verified</span>' : '<span class="badge amber">Pending verification</span>'}</td>
            <td class="cell-dim">${r.verifiedBy ? escapeHtml(db.staff.find(s=>s.id===r.verifiedBy)?.name||"—") : "—"}</td>
            ${canVerify ? `<td>${r.attendanceStatus==="PENDING_VERIFICATION" ? `<button class="btn btn-primary btn-sm" data-verify="${r.id}">Verify</button>` : ""}</td>` : ""}
          </tr>`).join("")}
        </tbody>
      </table>`;
    wrap.querySelectorAll("[data-verify]").forEach(b => b.addEventListener("click", () => verifyAttendance(b.dataset.verify)));
  }

  draw("ALL");
  el.querySelectorAll("#attFilter .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      el.querySelectorAll("#attFilter .chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      draw(chip.dataset.f);
    });
  });
};

function verifyAttendance(attId){
  const data = DB.read();
  const rec = data.attendance.find(a=>a.id===attId);
  const u = currentUser();
  if (!rec || rec.attendanceStatus !== "PENDING_VERIFICATION") return;
  rec.attendanceStatus = "VERIFIED";
  rec.verifiedBy = u.id;
  rec.verifiedAt = new Date().toISOString();
  DB.saveAll(data);
  toast("Attendance verified", "success");
  renderNotifications();
  RENDERERS.attendance();
  RENDERERS.dashboard();
}

/* ==========================================================================
   10. CERTIFICATIONS
   ========================================================================== */
RENDERERS.certifications = function(){
  const u = currentUser();
  const db = DB.read();
  const el = document.getElementById("view-certifications");
  const isStaffView = u.role === "staff";

  const pool = isStaffView
    ? (u.certifications||[]).map(c=>({...c, staffId:u.id, staffName:u.name}))
    : db.staff.flatMap(s => (s.certifications||[]).map(c=>({...c, staffId:s.id, staffName:s.name})));

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Certifications</h2>
        <p>Training certificates and licenses (First Aider, Safety Certification, Technical License, etc). Alerts fire at 30 days and 7 days before expiry; overdue items are flagged non-compliant.</p>
      </div>
      ${isStaffView ? `<button class="btn btn-primary" id="btnAddCert">+ Upload certification</button>` : ""}
    </div>

    <div class="chip-row" id="certFilter" style="margin-bottom:16px;">
      <button class="chip active" data-f="ALL">All</button>
      <button class="chip" data-f="REMINDER">Reminder (30d)</button>
      <button class="chip" data-f="URGENT">Urgent (7d)</button>
      <button class="chip" data-f="EXPIRED">Expired</button>
    </div>

    <div class="grid-cards" id="certGrid"></div>
  `;

  function draw(filter){
    const list = pool.filter(c => filter==="ALL" ? true : certStatus(c.expiryDate).level === filter);
    const grid = document.getElementById("certGrid");
    if (!list.length){ grid.innerHTML = emptyState("Nothing here", "No certifications match this filter."); return; }
    grid.innerHTML = list.map(c => {
      const st = certStatus(c.expiryDate);
      return `
      <div class="cert-card ${st.level!=='OK' ? 'hazard-edge' : ''}">
        <h4>${escapeHtml(c.name)}</h4>
        <div class="cert-meta">
          ${!isStaffView ? `${escapeHtml(c.staffName)}<br/>` : ""}
          Issued by ${escapeHtml(c.issuedBy)} on ${fmtDate(c.issuedDate)}<br/>
          Expires ${fmtDate(c.expiryDate)}
        </div>
        <div class="cert-foot">
          <span class="badge ${st.cls}">${st.label}</span>
          ${c.fileName ? `<span class="cell-dim mono" title="${escapeHtml(c.fileName)}">📎 ${escapeHtml(c.fileName.length>16?c.fileName.slice(0,14)+'…':c.fileName)}</span>` : ""}
        </div>
      </div>`;
    }).join("");
  }
  draw("ALL");
  el.querySelectorAll("#certFilter .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      el.querySelectorAll("#certFilter .chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      draw(chip.dataset.f);
    });
  });

  document.getElementById("btnAddCert")?.addEventListener("click", openAddCertModal);
};

function openAddCertModal(){
  openModal(`
    <div class="modal-head">
      <div><h3>Upload certification</h3><p>PDF or image. Stored securely against your staff profile.</p></div>
      <button class="modal-close" data-modal-close>&times;</button>
    </div>
    <div class="modal-body">
      <label class="field"><span>Certification name</span><input id="cName" placeholder="e.g. First Aider"/></label>
      <label class="field"><span>Issued by</span><input id="cIssuer" placeholder="e.g. St. John Ambulance"/></label>
      <div class="form-row">
        <label class="field"><span>Issued date</span><input id="cIssued" type="date"/></label>
        <label class="field"><span>Expiry date</span><input id="cExpiry" type="date"/></label>
      </div>
      <label class="field"><span>Certificate file (PDF/Image)</span><input id="cFile" type="file" accept=".pdf,image/*"/></label>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-modal-close>Cancel</button>
      <button class="btn btn-primary" id="saveCertBtn">Save certification</button>
    </div>
  `);

  document.getElementById("saveCertBtn").addEventListener("click", () => {
    const name = document.getElementById("cName").value.trim();
    const issuedBy = document.getElementById("cIssuer").value.trim();
    const issuedDate = document.getElementById("cIssued").value;
    const expiryDate = document.getElementById("cExpiry").value;
    const fileInput = document.getElementById("cFile");
    const file = fileInput.files[0];

    if (!name || !issuedBy || !issuedDate || !expiryDate){ toast("Please fill in all fields", "error"); return; }

    const save = (fileName, fileData) => {
      const data = DB.read();
      const u = currentUser();
      const staffRec = data.staff.find(s=>s.id===u.id);
      staffRec.certifications = staffRec.certifications || [];
      staffRec.certifications.push({ id:"cert_"+uid(), name, issuedBy, issuedDate, expiryDate, fileName: fileName||null, fileData: fileData||null });
      DB.saveAll(data);
      toast("Certification uploaded", "success");
      closeModal();
      renderNotifications();
      RENDERERS.certifications();
      RENDERERS.dashboard();
    };

    if (file && file.size < 1_500_000){
      const reader = new FileReader();
      reader.onload = () => save(file.name, reader.result);
      reader.onerror = () => save(file.name, null);
      reader.readAsDataURL(file);
    } else {
      save(file ? file.name : null, null);
    }
  });
}

/* ==========================================================================
   11. STAFF DIRECTORY (admin) — AD-synced, extended with SHE fields
   ========================================================================== */
RENDERERS.staff = function(){
  const db = DB.read();
  const el = document.getElementById("view-staff");

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Staff Directory</h2>
        <p>Name, email, department, and position auto-sync from Active Directory. Certifications and health condition are maintained locally.</p>
      </div>
      <input class="search-input" id="staffSearch" placeholder="Search name, email, department…"/>
    </div>
    <div class="panel"><div class="table-wrap" id="staffTableWrap"></div></div>
  `;

  function draw(q){
    q = (q||"").toLowerCase();
    const list = db.staff.filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.department.toLowerCase().includes(q));
    const wrap = document.getElementById("staffTableWrap");
    if (!list.length){ wrap.innerHTML = emptyState("No matches", "Try a different search term."); return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Position</th><th>Role</th><th>Certifications</th><th></th></tr></thead>
        <tbody>
        ${list.map(s => {
          const alerts = (s.certifications||[]).filter(c=>certStatus(c.expiryDate).level!=="OK").length;
          return `<tr>
            <td class="cell-strong">${escapeHtml(s.name)}</td>
            <td class="mono cell-dim">${escapeHtml(s.email)}</td>
            <td class="cell-dim">${escapeHtml(s.department)}</td>
            <td class="cell-dim">${escapeHtml(s.position)}</td>
            <td><span class="role-tag ${s.role}">${s.role}</span></td>
            <td>${s.certifications?.length||0} ${alerts? `<span class="badge red">${alerts} alert${alerts>1?'s':''}</span>`:''}</td>
            <td><button class="btn btn-ghost btn-sm" data-view-staff="${s.id}">View</button></td>
          </tr>`;
        }).join("")}
        </tbody>
      </table>`;
    wrap.querySelectorAll("[data-view-staff]").forEach(b => b.addEventListener("click", () => openStaffProfileModal(b.dataset.viewStaff)));
  }
  draw("");
  document.getElementById("staffSearch").addEventListener("input", (e) => draw(e.target.value));
};

function openStaffProfileModal(staffId){
  const db = DB.read();
  const s = db.staff.find(x=>x.id===staffId);
  if (!s) return;
  openModal(`
    <div class="modal-head">
      <div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.position)} · ${escapeHtml(s.department)}</p></div>
      <button class="modal-close" data-modal-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="field"><span>Email (AD)</span><div class="mono">${escapeHtml(s.email)}</div></div>
      <label class="field"><span>Health condition</span><textarea id="hcInput" rows="2">${escapeHtml(s.healthCondition||"")}</textarea></label>
      <div class="field">
        <span>Certifications (${s.certifications?.length||0})</span>
        ${(s.certifications||[]).length ? s.certifications.map(c => {
          const st = certStatus(c.expiryDate);
          return `<div class="cert-card ${st.level!=='OK'?'hazard-edge':''}" style="margin-bottom:8px;">
            <h4 style="font-size:13.5px;">${escapeHtml(c.name)}</h4>
            <div class="cert-meta">Expires ${fmtDate(c.expiryDate)}</div>
            <div class="cert-foot"><span class="badge ${st.cls}">${st.label}</span></div>
          </div>`;
        }).join("") : `<div class="cell-dim" style="font-size:12.5px;padding:8px 0;">No certifications on file.</div>`}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-modal-close>Close</button>
      <button class="btn btn-primary" id="saveHc">Save health note</button>
    </div>
  `);
  document.getElementById("saveHc").addEventListener("click", () => {
    const data = DB.read();
    data.staff.find(x=>x.id===staffId).healthCondition = document.getElementById("hcInput").value.trim();
    DB.saveAll(data);
    toast("Profile updated", "success");
    closeModal();
  });
}

/* ==========================================================================
   12. REPORTS
   ========================================================================== */
RENDERERS.reports = function(){
  const db = DB.read();
  const el = document.getElementById("view-reports");
  const totalAtt = db.attendance.length;
  const verified = db.attendance.filter(a=>a.attendanceStatus==="VERIFIED").length;
  const rate = totalAtt ? Math.round((verified/totalAtt)*100) : 0;
  const allCerts = db.staff.flatMap(s=>(s.certifications||[]).map(c=>({...c, staffName:s.name})));
  const nonCompliant = allCerts.filter(c=>certStatus(c.expiryDate).level==="EXPIRED");

  el.innerHTML = `
    <div class="view-head">
      <div><h2>Reports</h2><p>Export attendance and compliance data for audit and record-keeping.</p></div>
    </div>

    <div class="stat-grid">
      <div class="stat-card accent-green"><div class="stat-label">Verification rate</div><div class="stat-value">${rate}%</div><div class="stat-sub">${verified}/${totalAtt} records verified</div></div>
      <div class="stat-card accent-red"><div class="stat-label">Non-compliant certs</div><div class="stat-value">${nonCompliant.length}</div><div class="stat-sub">Expired &amp; unrenewed</div></div>
      <div class="stat-card accent-orange"><div class="stat-label">Events run</div><div class="stat-value">${db.events.length}</div><div class="stat-sub">${db.events.filter(e=>e.status==='ACTIVE').length} currently active</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Export data</h3></div>
      <div class="chip-row">
        <button class="btn btn-secondary btn-sm" id="expAttendance">⬇ Attendance CSV</button>
        <button class="btn btn-secondary btn-sm" id="expCerts">⬇ Certifications CSV</button>
        <button class="btn btn-secondary btn-sm" id="expStaff">⬇ Staff Directory CSV</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Non-compliance register</h3><span class="tag-count">Expired certifications</span></div>
      <div class="table-wrap">
        ${nonCompliant.length ? `<table>
          <thead><tr><th>Staff</th><th>Certification</th><th>Expired on</th><th>Days overdue</th></tr></thead>
          <tbody>${nonCompliant.map(c=>`<tr><td class="cell-strong">${escapeHtml(c.staffName)}</td><td>${escapeHtml(c.name)}</td><td class="mono cell-dim">${fmtDate(c.expiryDate)}</td><td><span class="badge red">${Math.abs(daysBetween(c.expiryDate))}d</span></td></tr>`).join("")}</tbody>
        </table>` : emptyState("No expired certifications", "Everyone is currently compliant.")}
      </div>
    </div>
  `;

  document.getElementById("expAttendance").addEventListener("click", () => {
    const rows = db.attendance.map(a => ({
      staff: db.staff.find(s=>s.id===a.staffId)?.name||"",
      event: db.events.find(e=>e.id===a.eventId)?.title||"",
      scannedAt: a.scannedAt, status: a.attendanceStatus,
      verifiedBy: db.staff.find(s=>s.id===a.verifiedBy)?.name||"", verifiedAt: a.verifiedAt||""
    }));
    downloadCSV(rows, "smartshe_attendance.csv");
  });
  document.getElementById("expCerts").addEventListener("click", () => {
    const rows = allCerts.map(c => ({ staff:c.staffName, name:c.name, issuedBy:c.issuedBy, issuedDate:c.issuedDate, expiryDate:c.expiryDate, status: certStatus(c.expiryDate).level }));
    downloadCSV(rows, "smartshe_certifications.csv");
  });
  document.getElementById("expStaff").addEventListener("click", () => {
    const rows = db.staff.map(s => ({ name:s.name, email:s.email, department:s.department, position:s.position, role:s.role, certifications:(s.certifications||[]).length }));
    downloadCSV(rows, "smartshe_staff_directory.csv");
  });
};

function downloadCSV(rows, filename){
  if (!rows.length){ toast("Nothing to export", "warn"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")].concat(
    rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g,'""')}"`).join(","))
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast("Export ready", "success");
}

/* ==========================================================================
   13. AUTH FLOW WIRING
   ========================================================================== */
function renderAdDirectoryList(){
  const wrap = document.getElementById("adDirectoryList");
  wrap.innerHTML = AD_DIRECTORY.map(u => `
    <div class="ad-row" data-email="${escapeHtml(u.email)}">
      <div class="avatar">${initials(u.name)}</div>
      <div class="ad-row-meta">
        <div class="ad-row-name">${escapeHtml(u.name)}</div>
        <div class="ad-row-email">${escapeHtml(u.email)}</div>
      </div>
      <span class="role-tag ${u.role}">${u.role}</span>
    </div>
  `).join("");
  wrap.querySelectorAll(".ad-row").forEach(row => {
    row.addEventListener("click", () => doLogin(row.dataset.email));
  });
}

function doLogin(email){
  const staffRecord = authenticateAD(email);
  const errBox = document.getElementById("loginError");
  if (!staffRecord){
    errBox.textContent = "UNAUTHENTICATED — this email is not recognized by company AD.";
    errBox.classList.remove("hidden");
    return;
  }
  errBox.classList.add("hidden");
  setSession(staffRecord.id);
  bootApp();
}

function bootApp(){
  const u = currentUser();
  if (!u){
    document.getElementById("mainApp").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    renderAdDirectoryList();
    return;
  }
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  applyRoleVisibility();
  renderUserChip();
  renderNotifications();
  const initial = VIEWS.includes(location.hash.replace("#","")) ? location.hash.replace("#","") : "dashboard";
  showView(initial);
}

/* ==========================================================================
   14. GLOBAL EVENT WIRING
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => document.getElementById("bootScreen").style.display = "none", 500);

  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin(document.getElementById("loginEmail").value);
  });

  document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    location.hash = "";
    bootApp();
  });

  document.getElementById("notifBtn").addEventListener("click", () => {
    document.getElementById("notifPanel").classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".notif-wrap")) document.getElementById("notifPanel")?.classList.add("hidden");
  });

  document.getElementById("mobileNavToggle").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
  });

  bootApp();
});

})();
