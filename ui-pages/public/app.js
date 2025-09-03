// ===== Beta Gate (V4 — minimal, loud, and reliable) =====
(function betaGateV4() {
  const CODE = "IWBETA25";               // single valid code
  const COOKIE = "iw_beta=ok";           // one-and-done on this device
  const LS_KEY = "iw.beta.ok";

  // quick helpers
  function setCookie(days = 400) {
    const d = new Date(); d.setTime(d.getTime() + days*24*60*60*1000);
    document.cookie = `${COOKIE}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
  }
  function hasCookie() {
    return document.cookie.split(";").some(s => s.trim().startsWith("iw_beta=ok"));
  }
  function hasAccess() {
    try { if (hasCookie()) return true; } catch {}
    try { if (localStorage.getItem(LS_KEY) === "1") return true; } catch {}
    return false;
  }
  function grantAccess() {
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
    setCookie();
    const panel = document.getElementById("beta-gate");
    if (panel) { try { panel.remove(); } catch { panel.hidden = true; panel.style.display = "none"; } }
    console.log("[beta] granted");
  }

  // emergency controls via URL:
  // ?beta=IWBETA25 -> unlock immediately
  // ?wipebeta=1    -> remove cookie+LS and force the panel
  (function urlControls() {
    try {
      const url = new URL(location.href);
      if (url.searchParams.get("wipebeta") === "1") {
        document.cookie = "iw_beta=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        try { localStorage.removeItem(LS_KEY); } catch {}
        console.warn("[beta] wiped local gate");
      }
      const p = (url.searchParams.get("beta") || "").trim().toUpperCase();
      if (p && p === CODE) {
        grantAccess();
        url.searchParams.delete("beta"); url.searchParams.delete("wipebeta");
        history.replaceState(null, "", url.toString());
        return; // done
      }
    } catch {}
  })();

  if (hasAccess()) { console.log("[beta] already unlocked"); return; }

  function wirePanel() {
    const panel = document.getElementById("beta-gate");
    if (!panel) { console.error("[beta] panel missing"); return; }
    panel.hidden = false;

    const form  = panel.querySelector("#beta-form");
    const input = panel.querySelector("#beta-input");
    const btn   = panel.querySelector("#beta-submit");
    const err   = panel.querySelector("#beta-error");

    function unlock() {
      const val = (input?.value || "").trim().toUpperCase();
      if (!val) return;
      if (val === CODE) {
        grantAccess();
      } else {
        if (err) err.textContent = "That code did not match. Try again.";
        input?.focus(); input?.select();
      }
    }

    form?.addEventListener("submit", (e) => { e.preventDefault(); unlock(); });
    btn?.addEventListener("click",   (e) => { e.preventDefault(); unlock(); });
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); unlock(); } });

    // loud breadcrumbs so we know it’s live
    console.log("[beta] V4 wired, waiting for input…");
    setTimeout(() => input?.focus(), 0);

    // expose tiny debug helpers
    window.iwBeta = {
      status: () => ({ hasCookie: hasCookie(), hasLS: localStorage.getItem(LS_KEY) === "1" }),
      grant: () => grantAccess(),
      wipe: () => { document.cookie = "iw_beta=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; try { localStorage.removeItem(LS_KEY); } catch {} }
    };
  }
document.addEventListener("DOMContentLoaded", wirePanel);
})();

// ===== Impulse Wallet — frontend (Pages Functions contract) =====
// API base (Pages). No Worker domain, no CORS headaches.
const API_BASE = "/impulse-api";

// ===== Simple client persistence (localStorage) =====
const IW_KEY = 'iw.session';

function saveSession(roomCode, displayName) {
  try {
    localStorage.setItem(IW_KEY, JSON.stringify({ roomCode, displayName, ts: Date.now() }));
  } catch {}
}
function getSession() {
  try { return JSON.parse(localStorage.getItem(IW_KEY)) || null; } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(IW_KEY); } catch {}
}
// --- leave room (client-only) ---
function leaveRoom({ redirect = true } = {}) {
  try { clearSession(); } catch {}
  roomCode = "";
  displayName = "";

  // Reset UI to pre-join state
  document.querySelector(".join")?.classList.remove("hidden");
  el.play?.classList.add("hidden");
  document.getElementById("focus-open")?.classList.add("hidden");
  document.getElementById("leave-room")?.classList.add("hidden");

  show?.("You left the room");
  if (redirect) location.href = "/";
}

// --- SFX (iOS-hardened): Web Audio + instant synth fallback ---
const SFX = { good: "/sfx/good.mp3", bad: "/sfx/bad.mp3" };

let ac = null;
let buffers = { good: null, bad: null };
let loading = false;

// Create / resume context
async function ensureCtx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
  if (ac.state !== "running") {
    try { await ac.resume(); } catch {}
  }
  return ac && ac.state === "running";
}

// Quick synth blip (works even while MP3s are still loading)
function synthClick(kind = "good") {
  try {
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    // good = higher, bad = lower
    const f0 = kind === "good" ? 880 : 440;
    osc.frequency.setValueAtTime(f0, now);

    // short envelope (pop-free)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain); gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {}
}

// Lazy-load and decode MP3s after first gesture (doesn’t block clicks)
async function loadBuffers() {
  if (loading || (buffers.good && buffers.bad)) return;
  loading = true;
  try {
    const [g, b] = await Promise.all(
      [SFX.good, SFX.bad].map(async (url) => {
        const res = await fetch(url, { cache: "force-cache" });
        const arr = await res.arrayBuffer();
        // Some iOS require decodeAudioData callback form; both supported:
        return await new Promise((resolve, reject) => {
          ac.decodeAudioData(arr, resolve, reject);
        });
      })
    );
    buffers.good = g; buffers.bad = b;
  } catch (e) {
    // decoding failed; synth fallback will keep working
    // console.warn("SFX decode failed", e);
  } finally {
    loading = false;
  }
}

// Public play: resume ctx, fire synth immediately, then prefer decoded buffer if ready
async function playSfx(kind) {
  const ok = await ensureCtx();

  // Always give instant feedback
  synthClick(kind);

  // If we have decoded buffers, layer the real sample (tight envelope so it feels like one sound)
  if (ok && buffers[kind]) {
    try {
      const src = ac.createBufferSource();
      const g = ac.createGain();
      src.buffer = buffers[kind];
      // tiny gain to avoid clipping when layered with synth
      g.gain.setValueAtTime(0.6, ac.currentTime);
      src.connect(g); g.connect(ac.destination);
      src.start();
    } catch {}
  } else {
    // kick off decode in the background
    loadBuffers();
  }
}

// Unlock + start loading on first gesture
["pointerdown","touchstart","click","keydown"].forEach(evt => {
  window.addEventListener(evt, async () => {
    if (await ensureCtx()) loadBuffers();
  }, { once: true, passive: true });
});


// --- dom refs ---
const $ = (sel) => document.querySelector(sel);
const el = {
  room: $("#room"),
  name: $("#name"),
  create: $("#create"),
  join: $("#join"),
  play: $("#play"),
  week: $("#week"),
  impulse: $("#impulse"),
  plus: $("#plus"),
  minus: $("#minus"),
  banner: $("#banner"),
  board: $("#board tbody"),
  undo: $("#undo"),
  months: $("#months"),
  mine: $("#mine tbody"),
  csv: $("#csv"),
   leaveBtn: document.getElementById("leave-room")
};
// ===== Auto-restore on load (stay in your room after refresh) =====
document.addEventListener('DOMContentLoaded', async () => {
  const s = getSession(); // {roomCode, displayName} or null
  if (!s || !s.roomCode) return;

  // hydrate globals + inputs
  roomCode = s.roomCode;
  displayName = s.displayName || '';

  if (el.room) el.room.value = roomCode;
  if (el.name) el.name.value = displayName;

  // show Play UI
  document.querySelector('.join')?.classList.add('hidden');
  el.play?.classList.remove('hidden');
  document.getElementById('focus-open')?.classList.remove('hidden');
  document.getElementById('leave-room')?.classList.remove('hidden');

  // load current state
  try { await initWeeklyFocusUI(); } catch {}
  try { await refresh(); } catch {}
});

// --- utils ---
function h(text) {
  return String(text).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
}
function genCode() {
  // 5-letter code A–Z
  return Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 5).toUpperCase();
}
async function api(path, opts = {}) {
  const r = await fetch(API_BASE + path, { headers: { "content-type": "application/json" }, ...opts });
  const txt = await r.text();
  let data; try { data = JSON.parse(txt); } catch { data = null; }
  if (!r.ok) throw new Error((data && data.error) || `${r.status} ${txt.slice(0, 120)}`);
  return data || {};
}
function show(msg, isLoss = false) {
  if (!el.banner) return;
  el.banner.textContent = msg;
  el.banner.classList.toggle("banner-loss", !!isLoss);
  el.banner.classList.remove("hidden");
  setTimeout(() => el.banner.classList.add("hidden"), 2200);
}
// Normalize timestamps coming from API (UTC) into Date objects in user's local time.
// - Epoch numbers: new Date(number)
// - ISO strings with Z/offset: new Date(ts)
// - Naïve "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS": treat as UTC
function parseTS(ts) {
  if (ts == null) return null;
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") {
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(ts)) {
      return new Date(ts.replace(" ", "T") + "Z");
    }
    return new Date(ts);
  }
  return new Date(ts);
}
// === Weekly window helpers (Monday 12:01 boundary is used for focus; here we just need week start at 00:00) ===
function getWeekStartLocal(d = new Date()) {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const start = new Date(d);
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() + diffToMonday);
  return start;
}
function isInCurrentWeek(ts) {
  const t = parseTS(ts);
  return t >= getWeekStartLocal();
}

// Compute per-player weekly balance and longest positive streak (deposits)
// Assumes state.history is ascending by created_at (your API already returns ASC)
function computeWeeklyStats(history) {
  const byPlayer = new Map();
  for (const r of history) {
    if (!r.created_at || !isInCurrentWeek(r.created_at)) continue;

    const name = r.player || "—";
    let s = byPlayer.get(name);
    if (!s) {
      s = { balance: 0, currentStreak: 0, longestStreak: 0 };
      byPlayer.set(name, s);
    }

    const delta = r.delta || 0;
    s.balance += delta;

    if (delta > 0) {
      s.currentStreak += 1;
      if (s.currentStreak > s.longestStreak) s.longestStreak = s.currentStreak;
    } else if (delta < 0) {
      s.currentStreak = 0; // any withdrawal breaks the streak
    }
  }
  return byPlayer;
}
// --- state ---
let roomCode = null;
let displayName = "";

// --- render ---
function paint(state) {
  // state: { ok, roomCode, balance, history:[{player,delta,label,created_at}] }
  const history = Array.isArray(state.history) ? state.history : [];

  // Weekly stats per player (balance + longest streak)
  const stats = computeWeeklyStats(history);

  // Leaderboard (sorted by weekly balance)
  el.board.innerHTML = "";
  const rows = Array.from(stats.entries()).sort((a, b) => b[1].balance - a[1].balance);
  for (const [name, s] of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${h(name)}</td>
      <td>${s.balance}</td>
      <td>${s.longestStreak || 0}</td>
    `;
    el.board.appendChild(tr);
  }

  // My history (latest first) — show ONLY my rows
  el.mine.innerHTML = "";
  const myHistory = history.filter(row => (row.player || "") === (displayName || ""));
  myHistory.slice().reverse().forEach(row => {
    const tr = document.createElement("tr");
const when = row.created_at
  ? parseTS(row.created_at).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })
  : "";
    tr.innerHTML = `<td>${h(when)}</td><td>${row.delta > 0 ? "+$1" : "-$1"}</td><td>${h(row.label || "")}</td><td>${h(row.player || "")}</td>`;
    el.mine.appendChild(tr);
  });

  // Weekly milestone banners based on this week's totals only
  const me = stats.get(displayName);
  if (me && me.balance >= 20) show("You hit +$20 this week. Keep going.");
  if (me && me.balance <= -20) show("You hit −$20 this week. Keep tracking.", true);
}


// --- data flows ---
async function refresh() {
  if (!roomCode) return;
  try {
    const data = await api(`/state?roomCode=${encodeURIComponent(roomCode)}`);
    paint(data);
  } catch (e) {
    console.error("Refresh failed:", e);
  }
}
async function createRoom() {
  try {
    displayName = (el.name.value || "").trim();
    const proposed = (el.room.value || "").trim().toUpperCase();
    const code = proposed || genCode();

    await api("/room", {
      method: "POST",
      body: JSON.stringify({ roomCode: code, displayName })
    });

    roomCode = code;
    el.room.value = roomCode;

    // Save session locally so user can rejoin after refresh
    saveSession(roomCode, displayName);

    $(".join")?.classList.add("hidden");
    el.play.classList.remove("hidden");

    // NEW: reveal Weekly Focus and init it
    document.getElementById("focus-open")?.classList.remove("hidden");
    await initWeeklyFocusUI();

    await refresh();
    show(`Room ${roomCode} ready`);
  } catch (e) {
    console.error(e);
    alert(`Create failed: ${e.message}`);
  }
}

async function doJoin() {
  try {
    roomCode = (el.room.value || "").trim().toUpperCase();
    displayName = (el.name.value || "").trim();
    if (!roomCode || !displayName) throw new Error("Enter room code and display name");

    // Ensure room exists (GET /room) before saving the session
    await api(`/room?roomCode=${encodeURIComponent(roomCode)}`);

    // Persist so a refresh keeps the session
    saveSession(roomCode, displayName);

    // Show Play UI once
    document.querySelector(".join")?.classList.add("hidden");
    el.play.classList.remove("hidden");
    document.getElementById("focus-open")?.classList.remove("hidden");

    // Init focus + state once
    await initWeeklyFocusUI();
    await refresh();

    show(`Joined ${roomCode}`);
  } catch (e) {
    console.error(e);
    alert(`Join failed: ${e.message}`);
  }
}



async function submit(amount) {
  try {
    if (!roomCode) throw new Error("Join or create a room first");

    // play sound instantly, before network call
    playSfx(amount === 1 ? "good" : "bad");

    const impulse = (el.impulse.value || "").trim();
    await api("/state", {
      method: "POST",
      body: JSON.stringify({ roomCode, entry: { delta: amount, label: impulse, player: displayName } })
    });
    el.impulse.value = "";
    await refresh();
  } catch (e) {
    console.error(e);
    alert(`Save failed: ${e.message}`);
  }
}

async function undoLast() {
  try {
    if (!roomCode) throw new Error("Join or create a room first");
    const player = (document.querySelector('#name')?.value || '').trim();
    await api(`/state?roomCode=${encodeURIComponent(roomCode)}&player=${encodeURIComponent(player)}`, { method: "DELETE" });
    await refresh();
  } catch (e) {
    console.error(e);
    alert(`Undo failed: ${e.message}`);
  }
}

async function loadHistory() {
  // Using same state endpoint; months selector retained for UX parity.
  await refresh();
}

function exportCSV() {
  const rows = [["When", "Amount", "Impulse", "Player"]];
  for (const tr of el.mine.querySelectorAll("tr")) {
    const cells = [...tr.children].map(td => `"${String(td.textContent).replace(/"/g, '""')}"`);
    rows.push(cells.join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "impulse_wallet_history.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- events ---
el.create?.addEventListener("click", createRoom);
el.join?.addEventListener("click", doJoin);
el.plus?.addEventListener("click", () => submit(+1));
el.minus?.addEventListener("click", () => submit(-1));
el.undo?.addEventListener("click", undoLast);
el.months?.addEventListener("change", loadHistory);
el.csv?.addEventListener("click", exportCSV);
el.leaveBtn?.addEventListener("click", () => leaveRoom());


// Instructions modal wiring
(function instructionsModal() {
  const openBtn = document.getElementById('instructions-open');
  const modal   = document.getElementById('instructions-modal');
  const closeBtn= document.getElementById('instructions-close');
  if (!openBtn || !modal || !closeBtn) return;

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector('.modal-content')?.focus();
    document.addEventListener('keydown', onKey);
  }
  function close() {
    modal.hidden = true;
    document.removeEventListener('keydown', onKey);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
})();
// --- background refresh ---
setInterval(() => { refresh(); }, 5000);
// ===== Weekly Focus (per-user, per-week; locks until Monday 12:01 AM) =====

// DOM hooks (optional elements; code no-ops if missing)
const focusEl = {
  open:  document.getElementById("focus-open"),
  modal: document.getElementById("focus-modal"),
  close: document.getElementById("focus-close"),
  form:  document.getElementById("focus-form"),
  error: document.getElementById("focus-error"),
  chips: document.getElementById("focus-chips"),
  addCustom: document.getElementById("focus-add-custom"),
  customInput: document.getElementById("focus-custom-input"),
};
// Remap legacy names to your new canonical labels; customs are untouched.
const FOCUS_RENAME = {
  "Eat Healthy": "Nutrition",
  "Exercise": "Sleep Hygiene",
  "Screen Time": "Scrolling",
  "Caffeine": "Sugar",
  "Booze": "Alcohol",
  "Hydration": "Words to Family",
};
function normalizeAreas(list) {
  return (list || []).map(a => FOCUS_RENAME[a] || a);
}
// Compute Monday boundary at 12:01 AM local; returns "YYYY-MM-DD"
function getWeekKeyLocal(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay(); // 0 Sun..6 Sat
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  d.setHours(0, 1, 0, 0); // 12:01 AM
  d.setDate(d.getDate() + diffToMonday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function focusApiGet(roomCode, player) {
  const weekKey = getWeekKeyLocal();
  const url = `${API_BASE}/focus?roomCode=${encodeURIComponent(roomCode)}&player=${encodeURIComponent(player || "")}&weekKey=${weekKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Focus load failed: ${r.status}`);
  return r.json(); // { roomCode, player, playerId, weekKey, areas, locked }
}

async function focusApiPost(roomCode, player, areas) {
  const weekKey = getWeekKeyLocal();
  const r = await fetch(`${API_BASE}/focus`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomCode, player, weekKey, areas }),
  });
  if (r.status === 409) throw new Error("Weekly focus already set");
  if (!r.ok) throw new Error(`Focus save failed: ${r.status}`);
  return r.json(); // { locked:true, areas:[...] }
}

// Render chips in header
function renderFocusChips(areas) {
  if (!focusEl.chips) return;
  focusEl.chips.innerHTML = "";
  if (!areas || areas.length === 0) return;
  for (const a of areas) {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = a;
    focusEl.chips.appendChild(span);
  }
}

// Sync form checkboxes with current areas
function hydrateFocusForm(areas) {
  if (!focusEl.form) return;
  // Uncheck all
  focusEl.form.querySelectorAll('input[name="focusArea"]').forEach(i => i.checked = false);

  // Ensure any saved custom options exist as checkboxes
  const grid = focusEl.form.querySelector(".focus-grid") || focusEl.form;
  for (const a of areas || []) {
    let box = Array.from(focusEl.form.querySelectorAll('input[name="focusArea"]')).find(i => i.value === a);
    if (!box) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "focusArea";
      input.value = a;
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + a));
      grid.appendChild(label);
      box = input;
    }
    box.checked = true;
  }
}

// Enable/disable UI based on lock
function setFocusLockedUI(locked, areas) {
  if (!focusEl.form) return;
  const controls = focusEl.form.querySelectorAll("input, button, select, textarea");
  controls.forEach(elm => elm.disabled = !!locked);
  if (focusEl.error) {
    focusEl.error.textContent = locked
      ? "Locked for this week. Resets Monday at 12:01 AM."
      : "Choose 2–3 areas. These will lock for the week.";
  }
  renderFocusChips(areas);
}

// Helpers for selection state and limit
function getSelectedFocusAreas() {
  if (!focusEl.form) return [];
  return Array.from(focusEl.form.querySelectorAll('input[name="focusArea"]:checked'))
    .map(i => i.value.trim());
}
function enforceFocusLimit() {
  if (!focusEl.form || !focusEl.error) return;
  const n = getSelectedFocusAreas().length;
  const boxes = Array.from(focusEl.form.querySelectorAll('input[name="focusArea"]'));
  const disable = n >= 3;
  boxes.forEach(b => { if (!b.checked) b.disabled = disable; });
  if (n < 2) focusEl.error.textContent = "Choose at least 2 areas.";
  else if (n > 3) focusEl.error.textContent = "Limit is 3 areas.";
  else focusEl.error.textContent = "";
}

// Public init called after you know roomCode + displayName
async function initWeeklyFocusUI() {
  if (!focusEl.form || !roomCode) return;

  try {
    const data = await focusApiGet(roomCode, displayName);
    const areas = normalizeAreas(data.areas || []);
    hydrateFocusForm(areas);                     // keeps custom-add behavior
    setFocusLockedUI(!!data.locked, areas);      // uses normalized for chips too
    enforceFocusLimit();
  } catch (e) {
    console.warn("Weekly Focus init failed:", e);
  }
}

// Modal wiring (mirrors your Instructions modal pattern)
(function focusModalWiring() {
  const { open, modal, close, form, addCustom, customInput } = focusEl;
  if (!open || !modal || !close || !form) return;

  let lastFocus = null;
  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector(".modal-content")?.focus();
    document.addEventListener("keydown", onKey);
    // Refresh state when opening, in case week moved or user reloaded
    initWeeklyFocusUI();
  }
  function closeModal() {
    modal.hidden = true;
    document.removeEventListener("keydown", onKey);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") closeModal();
  }

  open.addEventListener("click", openModal);
  close.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Form interactions
  form.addEventListener("change", (e) => {
    if (e.target && e.target.name === "focusArea") enforceFocusLimit();
  });

  // Optional: add custom focus area chip to the checklist
  if (addCustom && customInput) {
    addCustom.addEventListener("click", () => {
      const v = (customInput.value || "").trim();
      if (!v) return;
      const grid = form.querySelector(".focus-grid") || form;
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "focusArea";
      input.value = v;
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + v));
      grid.appendChild(label);
      input.checked = true;
      customInput.value = "";
      enforceFocusLimit();
    });
  }

  // Save -> lock
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const chosen = getSelectedFocusAreas();
    if (chosen.length < 2 || chosen.length > 3) { enforceFocusLimit(); return; }
    try {
      const res = await focusApiPost(roomCode, displayName, chosen);
      setFocusLockedUI(!!res.locked, res.areas || []);
      closeModal();
      show("Weekly Focus locked");
    } catch (err) {
      if (focusEl.error) {
        focusEl.error.textContent = err.message || "Failed to save focus";
      }
    }
  });
})();

// Call initWeeklyFocusUI after join/create so UI shows current lock state
const _createRoom = createRoom;
createRoom = async function wrappedCreateRoom() {
  await _createRoom();
  document.getElementById("focus-open")?.classList.remove("hidden");
  document.getElementById("leave-room")?.classList.remove("hidden");
  await initWeeklyFocusUI();
};

const _doJoin = doJoin;
doJoin = async function wrappedDoJoin() {
  await _doJoin();
  document.getElementById("focus-open")?.classList.remove("hidden");
  document.getElementById("leave-room")?.classList.remove("hidden");
  await initWeeklyFocusUI();
};

// Optional: when the week rolls over while app is open, refresh chips without reload
setInterval(() => {
  // If the computed weekKey changed since last call, reload focus state
  const wk = getWeekKeyLocal();
  if (!window.__lastWeekKey) window.__lastWeekKey = wk;
  if (window.__lastWeekKey !== wk) {
    window.__lastWeekKey = wk;
    initWeeklyFocusUI(); // will show unlocked state for the new week
  }
}, 60 * 1000); // check once per minute

// === Legal modals: Privacy + Terms (reuse your existing modal pattern) ===
(function wireLegalModals() {
  function wire(openId, modalId, closeId) {
    const openBtn  = document.getElementById(openId);
    const modal    = document.getElementById(modalId);
    const closeBtn = document.getElementById(closeId);
    if (!openBtn || !modal || !closeBtn) return;

    let lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      modal.querySelector('.modal-content')?.focus();
      document.addEventListener('keydown', onKey);
    }
    function close() {
      modal.hidden = true;
      document.removeEventListener('keydown', onKey);
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  wire('open-privacy', 'privacy-modal', 'privacy-close');
  wire('open-terms',   'terms-modal',   'terms-close');
})();
