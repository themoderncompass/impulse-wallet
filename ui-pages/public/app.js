// ===== Impulse Wallet — frontend (Pages Functions contract) =====
// API base (Pages). No Worker domain, no CORS headaches.
const API_BASE = "/impulse-api";

// Add this to your app.js - User ID Management Section
// ===== Anonymous User ID System =====

// Generate a UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get or create user ID (persists across sessions)
function getUserId() {
  let userId = localStorage.getItem('impulse_user_id');
  
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem('impulse_user_id', userId);
    console.log('Created new user ID:', userId);
    
    // Create user record on backend
    createUserRecord(userId);
  }
  
  return userId;
}

// Create user record in database
async function createUserRecord(userId) {
  try {
    const response = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 
        userId: userId,
        displayName: null, // Will be set when they join a room
        email: null        // For future use
      })
    });
    
    if (!response.ok) {
      console.warn('Failed to create user record:', response.status);
    }
  } catch (error) {
    console.warn('Error creating user record:', error);
  }
}

// Initialize user ID when app loads
let currentUserId = null;
let currentHistoryData = [];

function initUserSystem() {
  currentUserId = getUserId();
  console.log('Current user ID:', currentUserId);
}

// Call this when your app initializes
// Add this line to your existing app initialization
initUserSystem();

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
async function leaveRoom({ redirect = true } = {}) {
  try {
    // Call backend to properly remove user from room
    if (roomCode && currentUserId) {
      await api("/room-leave", {
        method: "POST",
        body: JSON.stringify({
          roomCode: roomCode,
          userId: currentUserId,
          confirmed: true
        })
      });
    }
  } catch (error) {
    console.error("Error leaving room:", error);
    // Continue with client cleanup even if backend fails
  }
  
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
  name: $("#name"),
  roomCode: $("#room-code"),
  inviteCode: $("#invite-code"),
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
  months: $("#history-months"),
  mine: $("#history-tbody"),
  csv: $("#history-csv"),
  leaveBtn: document.getElementById("leave-room"),
  historyOpen: $("#history-open"),
  historyModal: $("#history-modal"),
  historyClose: $("#history-close"),
  historyTable: $("#history-tbody"),
  historyMonths: $("#history-months"),
  historyCsv: $("#history-csv"),
  historyRefresh: $("#history-refresh"),
  // Note field elements removed
  noteCharCount: $(".note-char-count")
};
// ===== Auto-restore on load (stay in your room after refresh) =====
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize anonymous user system
  initUserSystem();

  // Initialize focus display to show selection prompt for new users
  updateFocusDisplay([]);


  // Session restoration code (moved inside the function)
  const s = getSession(); // {roomCode, displayName} or null
  if (!s || !s.roomCode) return; // ✅ Now this return is inside the function

  // hydrate globals + inputs
  roomCode = s.roomCode;
  displayName = s.displayName || '';

  // Room code field removed - now using invite code only
  if (el.name) el.name.value = displayName;

  // show Play UI
  document.querySelector('.join')?.classList.add('hidden');
  el.play?.classList.remove('hidden');
  document.getElementById('focus-open')?.classList.remove('hidden');
  document.getElementById('leave-room')?.classList.remove('hidden');
  
  // Show room settings if user is room creator (will check in API call)
  await checkIfRoomCreator();

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
// Enhanced notification system
let notificationId = 0;

function showNotification(message, type = 'success', duration = 4000) {
  const container = document.getElementById('notification-container');
  if (!container) {
    // Fallback to old banner system
    return show(message, type === 'error');
  }
  
  const id = ++notificationId;
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.dataset.id = id;
  
  const icons = {
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning', 
    info: 'Info'
  };
  
  notification.innerHTML = `
    <div class="notification-header">
      <span class="notification-icon">${icons[type] || icons.info}</span>
      <span>${titles[type] || titles.info}</span>
      <button class="notification-close" onclick="closeNotification(${id})" aria-label="Close">×</button>
    </div>
    <div class="notification-body">${message}</div>
  `;
  
  container.appendChild(notification);
  
  // Trigger show animation
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Auto close
  if (duration > 0) {
    setTimeout(() => closeNotification(id), duration);
  }
  
  return id;
}

function closeNotification(id) {
  const notification = document.querySelector(`[data-id="${id}"]`);
  if (!notification) return;
  
  notification.classList.remove('show');
  setTimeout(() => notification.remove(), 300);
}

// Legacy banner show/hide (keeping for backward compatibility)
function show(msg, isLoss = false) {
  if (el.banner) {
    el.banner.textContent = msg;
    el.banner.classList.toggle("banner-loss", !!isLoss);
    el.banner.classList.remove("hidden");
    setTimeout(() => el.banner.classList.add("hidden"), 2200);
  }
  
  // Also show as modern notification
  showNotification(msg, isLoss ? 'error' : 'success');
}
// Normalize timestamps coming from API into Date objects in user's local time.
// - Epoch numbers: new Date(number)
// - ISO strings with Z/offset: new Date(ts)
// - Naïve "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS": treat as local time
function parseTS(ts) {
  if (ts == null) return null;
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") {
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(ts)) {
      // Parse naive timestamp as local time instead of forcing UTC
      return new Date(ts.replace(" ", "T"));
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
  console.log('🗓️ Computing weekly stats for', history.length, 'entries');
  const byPlayer = new Map();
  const byUserId = new Map(); // Track by userId as backup
  let filteredCount = 0;
  for (const r of history) {
    if (!r.created_at || !isInCurrentWeek(r.created_at)) {
      console.log('🗓️ Skipping entry (not current week):', r);
      continue;
    }
    filteredCount++;

    const name = r.player || "—";
    const userId = r.userId || r.user_id; // Handle both field names

    console.log('🗓️ Processing entry - player:', name, 'userId:', userId, 'delta:', r.delta);

    // Track by player name
    let s = byPlayer.get(name);
    if (!s) {
      s = { balance: 0, currentStreak: 0, longestStreak: 0 };
      byPlayer.set(name, s);
    }

    // Also track by userId as backup
    if (userId) {
      let userStats = byUserId.get(userId);
      if (!userStats) {
        userStats = { balance: 0, currentStreak: 0, longestStreak: 0 };
        byUserId.set(userId, userStats);
      }

      const delta = r.delta || 0;
      userStats.balance += delta;
      if (delta > 0) {
        userStats.currentStreak += 1;
        if (userStats.currentStreak > userStats.longestStreak) userStats.longestStreak = userStats.currentStreak;
      } else if (delta < 0) {
        userStats.currentStreak = 0;
      }
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
  console.log('🗓️ Filtered', filteredCount, 'entries for current week');
  console.log('🗓️ Stats map size:', byPlayer.size);
  for (const [key, value] of byPlayer.entries()) {
    console.log('🗓️ Player:', key, 'Balance:', value.balance);
  }

  // Store byUserId for fallback lookup
  byPlayer._byUserId = byUserId;
  return byPlayer;
}
// Focus area emoji mapping - only includes predefined focus areas from HTML
const FOCUS_EMOJI_MAP = {
  'Eat Healthy': '🥗',
  'Exercise': '🏃',
  'Scrolling': '📱',
  'Snacking': '🍿',
  'Spending': '💳',
  'Booze': '🚫',
  'Procrastination': '⏰',
  'Gratitude': '🙏'
};

// Get emoji for focus area with intelligent matching for custom areas
function getFocusEmoji(focusArea) {
  const area = focusArea.trim();

  // Direct match
  if (FOCUS_EMOJI_MAP[area]) {
    return FOCUS_EMOJI_MAP[area];
  }

  // Fuzzy matching for custom areas
  const lowerArea = area.toLowerCase();
  for (const [key, emoji] of Object.entries(FOCUS_EMOJI_MAP)) {
    if (lowerArea.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerArea)) {
      return emoji;
    }
  }

  // Default for unmatched custom areas
  return '⭐';
}

// --- state ---
let roomCode = null;
let displayName = "";

// --- render ---
function paint(state) {
  console.log('🎨 paint() called with state:', state);
  // state: { ok, roomCode, balance, history:[{player,delta,label,created_at}] }
  const history = Array.isArray(state.history) ? state.history : [];

  // Only show room-specific buttons when successfully in a room (check if we have room state)
  const focusBtn = document.getElementById('focus-open');
  const roomBtn = document.getElementById('room-manage-open');

  // Check if we're actually in a room by verifying we have valid room data
  const inRoom = state.ok && roomCode && displayName && el.play && !el.play.classList.contains('hidden');

  if (inRoom) {
    if (focusBtn) focusBtn.classList.remove('hidden');
    if (roomBtn) roomBtn.classList.remove('hidden');

    // Show mobile focus areas when in room
    const mobileAreas = document.getElementById('mobile-focus-areas');
    if (mobileAreas) mobileAreas.style.display = 'block';
  } else {
    if (focusBtn) focusBtn.classList.add('hidden');
    if (roomBtn) roomBtn.classList.add('hidden');

    // Hide mobile focus areas when not in room
    const mobileAreas = document.getElementById('mobile-focus-areas');
    if (mobileAreas) mobileAreas.style.display = 'none';
  }

  // Weekly stats per player (balance + longest streak)
  const stats = computeWeeklyStats(history);

  // Leaderboard (sorted by weekly balance)
  el.board.innerHTML = "";
  const rows = Array.from(stats.entries()).sort((a, b) => b[1].balance - a[1].balance);
  for (const [name, s] of rows) {
    const tr = document.createElement("tr");
    // Calculate progress toward $20 goal (capped at 100%)
    const progressPercent = Math.min(Math.max((s.balance / 20) * 100, 0), 100);
    // Calculate fire emojis: 1 emoji for every 3 streaks (3=1🔥, 6=2🔥🔥, 9=3🔥🔥🔥, etc.)
    const fireCount = Math.floor(s.currentStreak / 3);
    const fireEmojis = '🔥'.repeat(fireCount);

    tr.innerHTML = `
      <td>${h(name)}</td>
      <td>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </td>
      <td>${fireEmojis}</td>
    `;
    el.board.appendChild(tr);
  }

  // My history (latest first) — show ONLY my rows
  console.log('🔍 About to render history, el.mine:', el.mine);
  try {
    el.mine.innerHTML = "";
    const myHistory = history.filter(row => (row.player || "") === (displayName || ""));
    console.log('🔍 Found', myHistory.length, 'history entries for', displayName);
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
  } catch (historyError) {
    console.warn('History rendering issue:', historyError.message || historyError);
    if (el.mine) el.mine.innerHTML = '<tr><td colspan="4">History unavailable</td></tr>';
  }

  // Balance resolution (matching main branch logic)
  const me = stats.get(displayName);
  console.log('🔢 Balance lookup - displayName:', displayName, 'me:', me);

  const currentBalance = me ? me.balance : 0;

  // Update balance display
  const balanceEl = document.getElementById('current-balance');
  if (balanceEl) {
    balanceEl.textContent = `$${currentBalance}`;
    console.log('🔢 Updated balance display to:', `$${currentBalance}`);
  }

  // Update history modal balance to match current balance
  const historyBalanceEl = document.getElementById('history-balance');
  if (historyBalanceEl) {
    historyBalanceEl.textContent = `$${currentBalance}`;
  }

  // Update wallet image based on balance
  updateWalletImage(currentBalance);


  // Use the currentBalance already calculated above for milestone checks

  // Only trigger milestone animations when we're actually in a room
  const inRoomForMilestones = state.ok && roomCode && displayName;

  if (inRoomForMilestones) {
    // Celebration for reaching +$20 (only trigger once per milestone achievement)
    if (currentBalance >= 20 && lastCelebrationBalance !== currentBalance) {
      show("You hit +$20 this week. Keep going.");
      showCelebration();
      lastCelebrationBalance = currentBalance;
    }

    // Warning for hitting -$20 (only trigger once per milestone)
    if (currentBalance <= -20 && lastWarningBalance !== currentBalance) {
      show("You hit −$20 this week. Keep tracking.", true);
      showWarning();
      lastWarningBalance = currentBalance;
    }

    // Reset milestone tracking if balance changes significantly
    if (currentBalance > -20 && currentBalance < 20) {
      lastCelebrationBalance = null;
      lastWarningBalance = null;
    }
  }
}


// --- data flows ---
async function refresh() {
  if (!roomCode) return;
  try {
    console.log('🔄 refresh() called for room:', roomCode, 'displayName:', displayName);
    const data = await api(`/state?roomCode=${encodeURIComponent(roomCode)}`);
    console.log('🔄 State API response:', data);
    paint(data);
    
    // Check if user is room creator to show/hide room management button
    await checkIfRoomCreator();
  } catch (e) {
    console.error("Refresh failed:", e);
  }
}
async function createRoom() {
  try {
    displayName = (el.name.value || "").trim();
    if (!displayName) throw new Error("Enter your display name");

    // Get room code from input or auto-generate
    let code = (el.roomCode.value || "").trim().toUpperCase();
    if (!code) {
      code = genCode(); // Auto-generate if empty
    }

    // Ensure we have a UUID at call time
    const uuid = currentUserId || getUserId();
    if (!uuid) throw new Error("Missing UUID; reload and try again.");

    const payload = { roomCode: code, displayName, userId: uuid };
    console.debug("POST /room payload:", payload);

    await api("/room", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    roomCode = code;

    saveSession(roomCode, displayName);

    document.querySelector(".join")?.classList.add("hidden");
    el.play.classList.remove("hidden");
    document.getElementById("focus-open")?.classList.remove("hidden");
    document.getElementById("leave-room")?.classList.remove("hidden");

    await initWeeklyFocusUI();
    await refresh();

    show(`Room ${roomCode} ready`);
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("DUPLICATE_NAME") || e.status === 409) {
      alert("That display name is already taken in this room. Please choose another.");
      return;
    }
    console.error(e);
    alert(`Create failed: ${e.message}`);
  }
}

async function doJoin() {
  try {
    displayName = (el.name.value || "").trim();
    if (!displayName) throw new Error("Enter your display name");

    // Get both room code and invite code
    const inputRoomCode = (el.roomCode.value || "").trim().toUpperCase();
    const inviteCode = (el.inviteCode.value || "").trim().toUpperCase();

    // Must have either room code OR invite code
    if (!inputRoomCode && !inviteCode) {
      throw new Error("Enter either a room name or an invite code");
    }

    const uuid = currentUserId || getUserId();
    if (!uuid) throw new Error("Missing UUID; reload and try again.");

    // Determine which flow to use
    if (inviteCode) {
      // Use invite code flow (private room)
      roomCode = "INVITE";
      var payload = { roomCode, displayName, userId: uuid, inviteCode };
    } else {
      // Use room code flow (public room)
      roomCode = inputRoomCode;
      var payload = { roomCode, displayName, userId: uuid };
    }
    console.debug("POST /room payload:", payload);

    const result = await api("/room", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    // Use the actual room code returned by the server (important for invite-code-only joins)
    roomCode = result.room?.code || roomCode;
    saveSession(roomCode, displayName);

    document.querySelector(".join")?.classList.add("hidden");
    el.play.classList.remove("hidden");
    document.getElementById("focus-open")?.classList.remove("hidden");
    document.getElementById("leave-room")?.classList.remove("hidden");
    
    // Check if user is room creator to show room management button
    await checkIfRoomCreator();

    await initWeeklyFocusUI();
    await refresh();

    show(`Joined ${roomCode}`);
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("DUPLICATE_NAME") || e.status === 409) {
      alert("That display name is already taken in this room. Please choose another.");
      return;
    }
    console.error(e);
    alert(`Join failed: ${e.message}`);
  }
}



async function submit(amount) {
  try {
    if (!roomCode) throw new Error("Join or create a room first");

    // Immediate SFX
    playSfx(amount === 1 ? "good" : "bad");

    const impulse = (el.impulse.value || "").trim();
    // Note field removed
    
    // Create entry with impulse label
    const entryData = { delta: amount, label: impulse, userId: currentUserId };
    
    await api("/state", {
      method: "POST",
      body: JSON.stringify({
        roomCode,
        entry: entryData
      })
    });

    el.impulse.value = "";
    await refresh();
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("AUTH_REQUIRED") || msg.includes("JOIN_REQUIRED") || /401|403/.test(msg)) {
      // bounce user back to join flow
      alert("Please rejoin the room (we need to confirm your name/UUID).");
      // show join UI
      document.querySelector(".join")?.classList.remove("hidden");
      el.play?.classList.add("hidden");
      return;
    }
    console.error(e);
    alert(`Save failed: ${e.message}`);
  }
}

async function undoLast() {
  try {
    if (!roomCode) throw new Error("Join or create a room first");
    await api(`/state?roomCode=${encodeURIComponent(roomCode)}&userId=${encodeURIComponent(currentUserId)}`, {
      method: "DELETE"
    });
    await refresh();
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("AUTH_REQUIRED") || msg.includes("JOIN_REQUIRED") || /401|403/.test(msg)) {
      alert("Please rejoin the room (we need to confirm your name/UUID).");
      document.querySelector(".join")?.classList.remove("hidden");
      el.play?.classList.add("hidden");
      return;
    }
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
el.leaveBtn?.addEventListener("click", () => {
  if (confirm("Are you sure you want to leave this room? You can rejoin anytime with the same room code.")) {
    leaveRoom();
  }
});

// ===== Note Field Functionality =====

// Toggle note field visibility
function toggleNoteField() {
  if (!el.noteField || !el.noteToggle) return;
  
  const isHidden = el.noteField.classList.contains('hidden');
  
  if (isHidden) {
    // Show note field
    el.noteField.classList.remove('hidden');
    el.noteField.classList.add('show');
    el.noteToggle.setAttribute('aria-expanded', 'true');
    el.noteToggle.querySelector('.note-toggle-text').textContent = 'Hide note';
    
    // Focus the textarea after animation
    setTimeout(() => {
      el.noteInput?.focus();
    }, 100);
  } else {
    // Hide note field
    el.noteField.classList.remove('show');
    el.noteField.classList.add('hidden');
    el.noteToggle.setAttribute('aria-expanded', 'false');
    el.noteToggle.querySelector('.note-toggle-text').textContent = 'Add note';
  }
}

// Update character count display
function updateCharCount() {
  if (!el.noteInput || !el.noteCharCount) return;
  
  const currentLength = el.noteInput.value.length;
  const maxLength = parseInt(el.noteInput.getAttribute('maxlength')) || 200;
  
  el.noteCharCount.textContent = `${currentLength}/${maxLength}`;
  
  // Update styling based on character count
  el.noteCharCount.classList.remove('warning', 'error');
  if (currentLength > maxLength * 0.9) {
    el.noteCharCount.classList.add('error');
  } else if (currentLength > maxLength * 0.75) {
    el.noteCharCount.classList.add('warning');
  }
}

// Clear note field
function clearNoteField() {
  if (!el.noteInput) return;
  
  el.noteInput.value = '';
  updateCharCount();
  el.noteInput.focus();
}

// Note field event listeners
// Note toggle and clear buttons removed
el.noteInput?.addEventListener('input', updateCharCount);

// Handle keyboard shortcuts
el.noteInput?.addEventListener('keydown', (e) => {
  // Escape key to close note field
  if (e.key === 'Escape') {
    toggleNoteField();
    e.preventDefault();
  }
  
  // Ctrl/Cmd + Enter to submit (focus main action)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    // Focus the plus button as default action
    el.plus?.focus();
  }
});

// Auto-collapse note field when clicking outside
document.addEventListener('click', (e) => {
  if (!el.noteField || !el.noteToggle) return;
  
  const noteContainer = document.querySelector('.note-field-container');
  const isClickInsideNote = noteContainer && noteContainer.contains(e.target);
  const isNoteVisible = !el.noteField.classList.contains('hidden');
  
  if (isNoteVisible && !isClickInsideNote) {
    // Only auto-collapse if the field is empty
    if (!el.noteInput?.value.trim()) {
      toggleNoteField();
    }
  }
});

// Initialize character count on page load
document.addEventListener('DOMContentLoaded', () => {
  updateCharCount();
});


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

function normalizeAreas(list) {
  return list || [];
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

// GET
async function focusApiGet(roomCode, userId) {
  const weekKey = getWeekKeyLocal();
  const url = `${API_BASE}/focus?roomCode=${encodeURIComponent(roomCode)}&userId=${encodeURIComponent(userId)}&weekKey=${weekKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Focus load failed: ${r.status}`);
  return r.json();
}

// POST
async function focusApiPost(roomCode, userId, areas) {
  const weekKey = getWeekKeyLocal();
  const r = await fetch(`${API_BASE}/focus`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomCode, userId, weekKey, areas }),
  });
  if (r.status === 409) throw new Error("Weekly focus already set");
  if (!r.ok) throw new Error(`Focus save failed: ${r.status}`);
  return r.json();
}

// Render chips in header (both desktop and mobile badge format)
function renderFocusChips(areas) {
  if (!focusEl.chips) return;
  focusEl.chips.innerHTML = "";

  // Also update mobile focus chips
  const mobileChips = document.getElementById('focus-chips-mobile');
  if (mobileChips) {
    mobileChips.innerHTML = "";
  }

  if (!areas || areas.length === 0) {
    if (mobileChips) mobileChips.style.display = 'none';
    return;
  }

  if (mobileChips) mobileChips.style.display = 'flex';

  for (const a of areas) {
    // Create emoji badge for mobile and desktop
    const emoji = getFocusEmoji(a);

    // Desktop chip (full text)
    const span = document.createElement("span");
    span.className = "chip";
    span.innerHTML = `
      <span class="chip-emoji">${emoji}</span>
      <span class="chip-label">${a}</span>
    `;
    focusEl.chips.appendChild(span);

    // Mobile chip (emoji only)
    if (mobileChips) {
      const mobileSpan = document.createElement("span");
      mobileSpan.className = "chip";
      mobileSpan.title = a; // Tooltip for accessibility
      mobileSpan.innerHTML = `
        <span class="chip-emoji">${emoji}</span>
        <span class="chip-label">${a}</span>
      `;
      mobileChips.appendChild(mobileSpan);
    }
  }
}

// Create checkbox element for a focus area
function createFocusAreaCheckbox(areaName, checked = false) {
  const label = document.createElement("label");
  label.className = "focus-area-label";
  
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = "focusArea";
  input.value = areaName;
  input.checked = checked;
  
  // Add event listener for limit enforcement
  input.addEventListener('change', enforceFocusLimit);
  
  label.appendChild(input);
  label.appendChild(document.createTextNode(" " + areaName));
  
  return label;
}

// Sync form checkboxes with current areas - FIXED VERSION
function hydrateFocusForm(savedAreas = []) {
  if (!focusEl.form) return;
  
  const grid = focusEl.form.querySelector(".focus-grid") || focusEl.form;
  
  // First, uncheck all existing checkboxes
  focusEl.form.querySelectorAll('input[name="focusArea"]').forEach(i => i.checked = false);
  
  // For each saved area, either check existing checkbox or create new one
  for (const areaName of savedAreas) {
    let existingInput = Array.from(focusEl.form.querySelectorAll('input[name="focusArea"]'))
      .find(input => input.value === areaName);
    
    if (existingInput) {
      // Area already exists as checkbox, just check it
      existingInput.checked = true;
    } else {
      // This is a custom area that needs to be recreated
      const newCheckbox = createFocusAreaCheckbox(areaName, true);
      grid.appendChild(newCheckbox);
    }
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
  updateFocusDisplay(areas);
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
  
  boxes.forEach(b => { 
    if (!b.checked) b.disabled = disable; 
  });
  
  if (n < 2) focusEl.error.textContent = "Choose at least 2 areas.";
  else if (n > 3) focusEl.error.textContent = "Limit is 3 areas.";
  else focusEl.error.textContent = "";
}

// Public init called after you know roomCode
async function initWeeklyFocusUI() {
  if (!focusEl.form || !roomCode) return;

  try {
    const data = await focusApiGet(roomCode, currentUserId);
    const areas = normalizeAreas(data.areas || []);

    hydrateFocusForm(areas);
    setFocusLockedUI(!!data.locked, areas);
    enforceFocusLimit();
  } catch (e) {
    console.warn("Weekly Focus init failed:", e);
    if (focusEl.error) {
      focusEl.error.textContent = "Could not load focus areas. Please try again.";
    }
    // Ensure UI shows selection prompt when there's an error loading areas
    updateFocusDisplay([]);
  }
}

// Handle form submission
async function handleFocusSubmit(event) {
  event.preventDefault();

  const selectedAreas = getSelectedFocusAreas();
  if (selectedAreas.length < 2 || selectedAreas.length > 3) {
    if (focusEl.error) focusEl.error.textContent = "Please select 2-3 focus areas.";
    return;
  }

  try {
    await focusApiPost(roomCode, currentUserId, selectedAreas);
    setFocusLockedUI(true, selectedAreas);
    if (focusEl.modal) focusEl.modal.hidden = true;
  } catch (error) {
    if (focusEl.error) {
      focusEl.error.textContent = error.message || "Failed to save focus areas.";
    }
  }
}

// Add custom focus area
function handleAddCustomArea() {
  if (!focusEl.customInput || !focusEl.form) return;
  
  const customArea = focusEl.customInput.value.trim();
  if (!customArea) return;
  
  // Check if area already exists
  const existing = Array.from(focusEl.form.querySelectorAll('input[name="focusArea"]'))
    .find(input => input.value.toLowerCase() === customArea.toLowerCase());
    
  if (existing) {
    existing.checked = true;
    focusEl.customInput.value = '';
    enforceFocusLimit();
    return;
  }
  
  // Add new checkbox for custom area
  const grid = focusEl.form.querySelector(".focus-grid") || focusEl.form;
  const newCheckbox = createFocusAreaCheckbox(customArea, true);
  grid.appendChild(newCheckbox);
  
  focusEl.customInput.value = '';
  enforceFocusLimit();
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

  // Event listeners
  open.addEventListener('click', openModal);
  close.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { 
    if (e.target === modal) closeModal(); 
  });
  
  // Form submission
  form.addEventListener('submit', handleFocusSubmit);
  
  // Add custom area functionality
  if (addCustom) {
    addCustom.addEventListener('click', handleAddCustomArea);
  }
  
  if (customInput) {
    customInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomArea();
      }
    });
  }
  
  // Add change listeners to existing checkboxes for limit enforcement
  form.querySelectorAll('input[name="focusArea"]').forEach(input => {
    input.addEventListener('change', enforceFocusLimit);
  });
})();

// Auto-refresh focus areas periodically (optional)
setInterval(() => {
  // Only refresh if not currently in modal and not locked
  if (focusEl.modal?.hidden !== false && roomCode && displayName) {
    initWeeklyFocusUI().catch(console.warn);
  }
}, 60000); // Check every minute

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

// === History Modal Implementation ===
function initHistoryModal() {
  const historyOpen = document.getElementById('history-open');
  const historyModal = document.getElementById('history-modal');
  const historyClose = document.getElementById('history-close');
  const historyTable = document.getElementById('history-tbody');
  const historyMonths = document.getElementById('history-months');
  const historyCsv = document.getElementById('history-csv');
  const historyRefresh = document.getElementById('history-refresh');
  
  console.log('History modal elements:', { historyOpen, historyModal, historyClose });
  
  if (!historyOpen || !historyModal || !historyClose) {
    console.warn('History modal elements not found');
    return;
  }
  
  let lastFocus = null;
  
  function openHistoryModal() {
    lastFocus = document.activeElement;
    historyModal.hidden = false;
    historyModal.querySelector('.modal-content')?.focus();
    document.addEventListener('keydown', onHistoryKey);
    loadHistoryData();
  }
  
  function closeHistoryModal() {
    historyModal.hidden = true;
    document.removeEventListener('keydown', onHistoryKey);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  
  function onHistoryKey(e) {
    if (e.key === 'Escape') closeHistoryModal();
  }
  
  async function loadHistoryData() {
    if (!roomCode) return;
    
    try {
      const data = await api(`/state?roomCode=${roomCode}`);
      currentHistoryData = Array.isArray(data.history) ? data.history : [];
      
      // Update stats
      updateHistoryStats();
      
      // Render table
      renderHistoryTable();
      
    } catch (error) {
      console.error('Failed to load history:', error);
      showNotification('Failed to load history: ' + error.message, 'error');
    }
  }
  
  function updateHistoryStats() {
    const myHistory = currentHistoryData.filter(row => row.player === displayName);
    const totalEntries = myHistory.length;
    const currentBalance = myHistory.reduce((sum, row) => sum + (row.delta || 0), 0);
    
    // Calculate best streak
    let bestStreak = 0;
    let currentStreak = 0;
    for (const entry of myHistory) {
      if (entry.delta > 0) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    // Update UI
    const totalEl = document.getElementById('total-entries');
    const balanceEl = document.getElementById('current-balance');  
    const streakEl = document.getElementById('best-streak');
    
    if (totalEl) totalEl.textContent = totalEntries;
    if (balanceEl) balanceEl.textContent = `$${currentBalance}`;
    if (streakEl) streakEl.textContent = bestStreak;
    
    // Note: history modal balance is now updated in paint() function to use same logic
  }
  
  function renderHistoryTable() {
    if (!historyTable) return;
    
    const monthsFilter = historyMonths?.value || '12';
    const myHistory = currentHistoryData.filter(row => row.player === displayName);
    
    // Apply time filter
    let filteredHistory = myHistory;
    if (monthsFilter !== 'all') {
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(monthsFilter));
      filteredHistory = myHistory.filter(row => {
        const entryDate = new Date(row.created_at);
        return entryDate >= monthsAgo;
      });
    }
    
    // Sort newest first
    filteredHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Clear table
    historyTable.innerHTML = '';
    
    // Show empty state if no data
    const emptyState = document.getElementById('history-empty');
    if (filteredHistory.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    } else {
      if (emptyState) emptyState.hidden = true;
    }
    
    // Populate table
    filteredHistory.forEach(row => {
      const tr = document.createElement('tr');
      
      const when = window.formatTimestamp(row.created_at);
      const type = row.delta > 0 ? 'Deposit' : 'Withdrawal';
      const typeClass = row.delta > 0 ? 'positive' : 'negative';
      const amount = `$${Math.abs(row.delta)}`;
      const note = row.label || '—';
      
      tr.innerHTML = `
        <td>${when}</td>
        <td><span class="entry-type ${typeClass}">${type}</span></td>
        <td>${amount}</td>
        <td>${note}</td>
        <td>
          <button class="action-btn" onclick="viewEntryDetails('${row.created_at}')">
            Details
          </button>
        </td>
      `;
      
      historyTable.appendChild(tr);
    });
  }
  
  function formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timestamp || '—';
    }
  }
  
  function exportHistoryCSV() {
    const myHistory = currentHistoryData.filter(row => row.player === displayName);
    
    if (myHistory.length === 0) {
      showNotification('No history to export', 'warning');
      return;
    }
    
    const headers = ['Date', 'Type', 'Amount', 'Note'];
    const rows = [headers.join(',')];
    
    myHistory.forEach(row => {
      const date = window.formatTimestamp(row.created_at);
      const type = row.delta > 0 ? 'Deposit' : 'Withdrawal';
      const amount = Math.abs(row.delta);
      const note = (row.label || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
      
      rows.push(`"${date}","${type}","${amount}","${note}"`);
    });
    
    const csvContent = rows.join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `impulse-wallet-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification('History exported successfully!', 'success');
  }
  
  // Event listeners
  historyOpen.addEventListener('click', openHistoryModal);
  historyClose.addEventListener('click', closeHistoryModal);
  historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) closeHistoryModal();
  });
  
  if (historyMonths) {
    historyMonths.addEventListener('change', renderHistoryTable);
  }
  
  if (historyCsv) {
    historyCsv.addEventListener('click', exportHistoryCSV);
  }
  
  if (historyRefresh) {
    historyRefresh.addEventListener('click', loadHistoryData);
  }
  
  // Newsletter dismiss functionality
  const newsletterDismiss = document.getElementById('newsletter-dismiss');
  const newsletterSection = document.querySelector('.newsletter-section');
  
  if (newsletterDismiss && newsletterSection) {
    newsletterDismiss.addEventListener('click', () => {
      newsletterSection.classList.add('dismissed');
      
      // Remember user dismissed it (don't show again this session)
      try {
        sessionStorage.setItem('newsletter-dismissed', 'true');
      } catch (e) {
        // Ignore storage errors
      }
    });
    
    // Always show newsletter when history modal opens (removed session storage check)
    // This ensures it appears every time for maximum visibility
  }
}

// Initialize history modal after DOM is loaded
document.addEventListener('DOMContentLoaded', initHistoryModal);

// === Room Management ===
async function checkIfRoomCreator() {
  if (!roomCode || !currentUserId) return;
  
  // MVP Launch: Show room management for all room members
  try {
    const response = await fetch(`${API_BASE}/room-manage?roomCode=${roomCode}&userId=${currentUserId}`);
    if (response.ok) {
      // User is room member, show room settings button
      document.getElementById('room-manage-open')?.classList.remove('hidden');
    } else {
      // User is not a room member, hide button
      document.getElementById('room-manage-open')?.classList.add('hidden');
    }
  } catch (error) {
    console.log('Could not check room member status:', error.message);
    document.getElementById('room-manage-open')?.classList.add('hidden');
  }
}

// Room Management Modal - Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  const openBtn = document.getElementById('room-manage-open');
  const modal = document.getElementById('room-manage-modal');
  const closeBtn = document.getElementById('room-manage-close');
  const cancelBtn = document.getElementById('cancel-room-settings');
  const saveBtn = document.getElementById('save-room-settings');
  
  if (!openBtn || !modal || !closeBtn) {
    console.warn('Room management modal elements not found:', { openBtn: !!openBtn, modal: !!modal, closeBtn: !!closeBtn });
    return;
  }
  
  let lastFocus = null;
  
  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector('.modal-content')?.focus();
    loadRoomSettings();
  }
  
  function closeModal() {
    modal.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  
  async function loadRoomSettings() {
    if (!roomCode || !currentUserId) return;
    
    try {
      const response = await fetch(`${API_BASE}/room-manage?roomCode=${roomCode}&userId=${currentUserId}`);
      const data = await response.json();
      
      if (data.ok) {
        // Update UI with current settings
        document.getElementById('room-code-display').textContent = data.room.code;
        // Checkbox is now "Make Public" so invert the inviteOnly value
        document.getElementById('room-invite-only').checked = !data.room.inviteOnly;
        document.getElementById('room-max-members').value = data.room.maxMembers;
        document.getElementById('member-count').textContent = data.memberCount;
        document.getElementById('invite-code-value').value = data.room.inviteCode || '—';
        
        // Update members list
        const membersList = document.getElementById('members-list');
        membersList.innerHTML = '';
        data.members.forEach(member => {
          const div = document.createElement('div');
          div.className = 'member-item';
          const isCreator = member.userId === currentUserId;
          div.innerHTML = `
            <span class="member-name">${member.name}</span>
            <span class="member-role">${isCreator ? 'Creator' : 'Member'}</span>
          `;
          membersList.appendChild(div);
        });
      }
    } catch (error) {
      showNotification('Failed to load room settings: ' + error.message, 'error');
    }
  }
  
  async function saveSettings() {
    if (!roomCode || !currentUserId) return;
    
    try {
      const settings = {
        roomCode,
        userId: currentUserId,
        // Checkbox is now "Make Public" so invert the value for inviteOnly
        inviteOnly: !document.getElementById('room-invite-only').checked,
        maxMembers: parseInt(document.getElementById('room-max-members').value)
      };
      
      const response = await fetch(`${API_BASE}/room-manage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      const data = await response.json();
      
      if (data.ok) {
        showNotification('Room settings updated successfully!', 'success');
        closeModal();
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      showNotification('Failed to save settings: ' + error.message, 'error');
    }
  }
  
  // Event listeners
  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  
  // Copy invite code functionality
  const copyBtn = document.getElementById('copy-invite-code');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const inviteCodeInput = document.getElementById('invite-code-value');
      if (inviteCodeInput && inviteCodeInput.value && inviteCodeInput.value !== '—') {
        try {
          await navigator.clipboard.writeText(inviteCodeInput.value);
          showNotification('Invite code copied to clipboard!', 'success');
        } catch (err) {
          // Fallback for older browsers
          inviteCodeInput.select();
          document.execCommand('copy');
          showNotification('Invite code copied to clipboard!', 'success');
        }
      }
    });
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
});

// Global utility function for formatting timestamps
window.formatTimestamp = function(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return timestamp || '—';
  }
};

// Global function for entry details (called from table)
window.viewEntryDetails = function(timestamp) {
  const entry = currentHistoryData.find(row => row.created_at === timestamp && row.player === displayName);
  if (!entry) return;
  
  const type = entry.delta > 0 ? 'Deposit' : 'Withdrawal';
  const amount = Math.abs(entry.delta);
  const note = entry.label || 'No note';
  const date = window.formatTimestamp(entry.created_at);
  
  showNotification(`${type} of $${amount} on ${date}. Note: "${note}"`, 'info', 8000);
};

// ===== Celebration System =====

// Variables to track milestone state and prevent duplicate celebrations
let lastCelebrationBalance = null;
let lastWarningBalance = null;

// Create floating number effect
function createFloatingNumber(button, amount) {
  const rect = button.getBoundingClientRect();
  const floating = document.createElement('div');
  floating.className = 'floating-number';
  floating.textContent = amount > 0 ? `+$${amount}` : `-$${Math.abs(amount)}`;
  floating.style.left = `${rect.left + rect.width / 2}px`;
  floating.style.top = `${rect.top}px`;
  
  document.body.appendChild(floating);
  
  // Remove after animation
  setTimeout(() => {
    if (floating.parentNode) {
      floating.parentNode.removeChild(floating);
    }
  }, 2000);
}

// Create ripple effect on button click
function createRipple(button, event) {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  const ripple = document.createElement('div');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  
  button.appendChild(ripple);
  
  // Remove after animation
  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple);
    }
  }, 600);
}

// Show milestone celebration with falling dollars and confetti from prototype
function showCelebration() {
  console.log('🎉 TRIGGERING CELEBRATION ANIMATION!');
  
  // Create celebration container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);
  
  // Success text
  const successText = document.createElement('div');
  successText.textContent = 'Goal Achieved! 🎉';
  successText.style.position = 'fixed';
  successText.style.top = '40%';
  successText.style.left = '50%';
  successText.style.transform = 'translate(-50%, -50%)';
  successText.style.fontSize = '3rem';
  successText.style.fontWeight = 'bold';
  successText.style.color = '#68d391';
  successText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.3)';
  successText.style.zIndex = '10000';
  successText.style.pointerEvents = 'none';
  successText.style.animation = 'successTextPop 2.5s ease-out';
  container.appendChild(successText);
  
  // Create falling dollars (15 dollar bills)
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      const dollar = document.createElement('div');
      dollar.className = 'falling-dollar';
      dollar.style.position = 'absolute';
      dollar.style.width = '40px';
      dollar.style.height = '65px';
      dollar.style.backgroundImage = 'url("wallet-assets/Dollar.png")';
      dollar.style.backgroundSize = 'contain';
      dollar.style.backgroundRepeat = 'no-repeat';
      dollar.style.backgroundPosition = 'center';
      dollar.style.left = Math.random() * 100 + 'vw';
      dollar.style.top = '-100px';
      dollar.style.animationDelay = Math.random() * 0.5 + 's';
      dollar.style.animation = `dollarFall ${2 + Math.random()}s linear forwards`;
      dollar.style.pointerEvents = 'none';
      container.appendChild(dollar);
    }, i * 100);
  }
  
  // Create confetti (30 pieces)
  const colors = ['#ff6b35', '#f7931e', '#ffcc02', '#68d391', '#4ecdc4', '#a78bfa'];
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.position = 'absolute';
      confetti.style.width = '8px';
      confetti.style.height = '8px';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.top = '-10px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 0.3 + 's';
      confetti.style.animation = `confettiFall ${1.5 + Math.random() * 0.5}s linear forwards`;
      confetti.style.pointerEvents = 'none';
      container.appendChild(confetti);
    }, i * 50);
  }
  
  // Clean up after animation
  setTimeout(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }, 4000);
}

// Show milestone warning with recharge animation from prototype
function showWarning() {
  console.log('💥 TRIGGERING ENHANCED FAILURE ANIMATION!');

  // Create animation container
  const container = document.createElement('div');
  container.className = 'animation-container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  // Create screen shake effect
  document.body.style.animation = 'screenShake 0.5s ease-in-out';
  setTimeout(() => {
    document.body.style.animation = '';
  }, 500);

  // Create falling broken heart emojis
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      const heart = document.createElement('div');
      heart.style.position = 'absolute';
      heart.style.left = Math.random() * 100 + 'vw';
      heart.style.top = '-50px';
      heart.style.fontSize = '40px';
      heart.style.zIndex = '1001';
      heart.style.animation = `fallHearts ${3 + Math.random()}s linear forwards`;
      heart.textContent = '💔';
      container.appendChild(heart);
    }, i * 100);
  }

  // Create central dramatic emoji with pulse
  const centralEmoji = document.createElement('div');
  centralEmoji.style.position = 'fixed';
  centralEmoji.style.top = '35%';
  centralEmoji.style.left = '50%';
  centralEmoji.style.transform = 'translate(-50%, -50%)';
  centralEmoji.style.fontSize = '100px';
  centralEmoji.style.zIndex = '1002';
  centralEmoji.style.animation = 'dramaPulse 2s ease-out';
  centralEmoji.textContent = '😰';
  container.appendChild(centralEmoji);

  // Create floating sad emojis around the screen
  const sadEmojis = ['😔', '😞', '😢', '😭', '😩'];
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const emoji = document.createElement('div');
      emoji.style.position = 'fixed';
      emoji.style.left = Math.random() * 80 + 10 + '%';
      emoji.style.top = Math.random() * 60 + 20 + '%';
      emoji.style.fontSize = '30px';
      emoji.style.zIndex = '1001';
      emoji.style.animation = 'floatSad 2s ease-in-out infinite';
      emoji.textContent = sadEmojis[Math.floor(Math.random() * sadEmojis.length)];
      container.appendChild(emoji);
    }, i * 200);
  }

  // Create motivational comeback text
  const motivationalText = document.createElement('div');
  motivationalText.innerHTML = 'Reset & Rise! 💪<br><small>Every setback is a setup for a comeback</small>';
  motivationalText.style.position = 'fixed';
  motivationalText.style.top = '65%';
  motivationalText.style.left = '50%';
  motivationalText.style.transform = 'translate(-50%, -50%)';
  motivationalText.style.color = '#dc2626';
  motivationalText.style.fontSize = '28px';
  motivationalText.style.fontWeight = '700';
  motivationalText.style.textAlign = 'center';
  motivationalText.style.pointerEvents = 'none';
  motivationalText.style.zIndex = '1001';
  motivationalText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.3)';
  motivationalText.style.animation = 'comebackGlow 2.5s ease-out';
  motivationalText.style.opacity = '0';
  container.appendChild(motivationalText);

  // Delayed text appearance with dramatic entrance
  setTimeout(() => {
    motivationalText.style.opacity = '1';
    motivationalText.style.animation = 'comebackGlow 2s ease-out';
  }, 1000);

  // Add wallet dramatic drain effect
  const walletImage = document.getElementById('wallet-display');
  if (walletImage) {
    walletImage.style.animation = 'walletDrain 1.5s ease-out';
  }

  // Clean up after animation
  setTimeout(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (walletImage) {
      walletImage.style.animation = '';
    }
  }, 4000);
}

// Close celebration overlay
function closeCelebration() {
  const overlay = document.getElementById('celebration-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Close warning overlay  
function closeWarning() {
  const overlay = document.getElementById('milestone-warning');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Make close functions global for onclick handlers
window.closeCelebration = closeCelebration;
window.closeWarning = closeWarning;

// Enhanced button click handler
function enhanceButtonClicks() {
  const plusBtn = document.getElementById('plus');
  const minusBtn = document.getElementById('minus');
  
  if (plusBtn) {
    plusBtn.addEventListener('click', function(event) {
      createRipple(this, event);
      createFloatingNumber(this, 1);
    });
  }
  
  if (minusBtn) {
    minusBtn.addEventListener('click', function(event) {
      createRipple(this, event);
      createFloatingNumber(this, -1);
    });
  }
}

// Initialize celebration system when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  enhanceButtonClicks();
});

// Test keyboard shortcuts from prototype (for testing animations)

// ===== WALLET IMAGE SYSTEM =====
let lastWalletBalance = null; // Track previous balance to avoid unnecessary animations

function updateWalletImage(balance) {
  const walletImage = document.getElementById('wallet-display');
  if (!walletImage) {
    console.log('Wallet image element not found');
    return;
  }

  // Only animate if balance actually changed
  const balanceChanged = lastWalletBalance !== balance;

  let imageName = 'Wallet empty.png';

  // Use all 5 wallet states based on dollar amount
  if (balance >= 15) imageName = 'Wallet 4 bills.png';
  else if (balance >= 10) imageName = 'Wallet 3 bills.png';
  else if (balance >= 5) imageName = 'Wallet 2 bills.png';
  else if (balance >= 1) imageName = 'Wallet 1 bill.png';
  else imageName = 'Wallet empty.png';

  console.log('Updating wallet image:', imageName, 'for balance:', balance);

  // Only add animation if balance changed
  if (balanceChanged) {
    walletImage.classList.add('updating');
    // Remove animation class after animation completes
    setTimeout(() => {
      walletImage.classList.remove('updating');
    }, 500);
  }

  // Update image - fixed path
  walletImage.style.backgroundImage = `url('wallet-assets/${imageName}')`;

  // Ensure element has proper size and background settings
  walletImage.style.width = '300px';
  walletImage.style.height = '200px';
  walletImage.style.backgroundSize = 'contain';
  walletImage.style.backgroundRepeat = 'no-repeat';
  walletImage.style.backgroundPosition = 'center';

  // Update tracked balance
  lastWalletBalance = balance;
}

// Focus modal functionality
function openFocusModal() {
  const focusModal = document.getElementById('focus-modal');
  if (focusModal) {
    focusModal.hidden = false;
  }
}

// Update focus area display (both desktop and mobile)
function updateFocusDisplay(focusAreas) {
  // There's only one focus prompt element used for both desktop and mobile
  const focusPrompt = document.getElementById('focus-selection-prompt');
  const focusChips = document.getElementById('focus-chips');

  if (focusAreas && focusAreas.length > 0) {
    // Hide prompt, show focus chips
    if (focusPrompt) focusPrompt.style.display = 'none';
    if (focusChips) {
      focusChips.classList.remove('hidden');
      focusChips.style.display = 'block';
    }
  } else {
    // Show prompt, hide focus chips
    if (focusPrompt) focusPrompt.style.display = 'flex';
    if (focusChips) {
      focusChips.classList.add('hidden');
      focusChips.style.display = 'none';
    }
  }
}

// Settings menu functionality
function toggleSettings() {
  console.log('🍔 toggleSettings called!');
  const toggle = document.querySelector('.settings-toggle');
  const dropdown = document.getElementById('settingsDropdown');
  
  console.log('🔍 Elements found:', { toggle: !!toggle, dropdown: !!dropdown });
  
  if (toggle && dropdown) {
    toggle.classList.toggle('active');
    dropdown.classList.toggle('active');
    console.log('✅ Classes toggled - active:', toggle.classList.contains('active'));
  } else {
    console.error('❌ Missing elements:', { toggle, dropdown });
  }
}

// Make toggleSettings globally available for onclick handlers
window.toggleSettings = toggleSettings;

// Add backup event listener for settings menu
document.addEventListener('DOMContentLoaded', function() {
  const settingsToggle = document.querySelector('.settings-toggle');
  if (settingsToggle) {
    console.log('🎯 Adding backup click listener to settings toggle');
    settingsToggle.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('🖱️ Settings toggle clicked via event listener');
      toggleSettings();
    });
  } else {
    console.warn('⚠️ Settings toggle not found in DOM');
  }
});


// ===== ONBOARDING SYSTEM =====

let currentOnboardingStep = 0;
let onboardingCompleted = false;

// Onboarding steps from prototype
const onboardingSteps = [
  {
    title: "Welcome to Impulse Wallet!",
    text: "Your personal accountability partner! Track your actions and stay committed to the goals that matter to you.",
    button: "Let's Start!",
    highlight: null,
    tooltip: null
  },
  {
    title: "Your Progress Tracker",
    text: "This wallet represents your commitment! Each dollar shows you followed through on your promises to yourself. Consistency builds character!",
    button: "Got it!",
    highlight: "#wallet-display",
    tooltip: { element: "#wallet-display", text: "Your wallet grows with follow-through!" }
  },
  {
    title: "Stay Accountable",
    text: "Your balance reflects your follow-through. Each +$1 means you kept a commitment. Your $20 weekly goal keeps you moving forward!",
    button: "Makes sense!",
    highlight: "#current-balance",
    tooltip: { element: "#current-balance", text: "Your accountability tracker" }
  },
  {
    title: "Log Your Actions",
    text: "Be honest with yourself! +$1 when you follow through, -$1 when you fall short. Accountability means owning both wins and setbacks!",
    button: "Let me try!",
    highlight: ".balance-actions",
    tooltip: { element: ".action-button", text: "Click to log your commitments!" }
  },
  {
    title: "Your Commitments",
    text: "These are your weekly promises to yourself. Three focus areas keep you from spreading too thin. Choose what matters most!",
    button: "I understand!",
    highlight: ".focus-areas",
    tooltip: { element: ".focus-chip", text: "Your weekly commitments" }
  },
  {
    title: "Compete & Connect",
    text: "See how you're doing compared to others in your room! The progress bars show everyone's journey toward the weekly $20 goal.",
    button: "Exciting!",
    highlight: ".leaderboard",
    tooltip: { element: ".leaderboard", text: "Friendly competition motivates growth!" }
  },
  {
    title: "Ready to Build Habits!",
    text: "You're all set! Start by making a deposit for a positive action you've completed. Watch your wallet grow and celebrate your progress!",
    button: "Start Building!",
    highlight: "#plus",
    tooltip: null
  }
];

// Initialize onboarding
function initOnboarding() {
  // Check if user has completed onboarding
  const completed = localStorage.getItem("onboardingCompleted");
  if (completed === "true") {
    onboardingCompleted = true;
    return;
  }

  // TEMPORARY: Skip onboarding for development
  console.log("🚧 Skipping onboarding for development");
  localStorage.setItem("onboardingCompleted", "true");
  onboardingCompleted = true;
  return;

  console.log("🎓 Starting onboarding...");
  onboardingCompleted = false;
  currentOnboardingStep = 0;

  // Start onboarding after brief delay
  setTimeout(() => {
    hideNonEssentialElements();
    showOnboardingOverlay();
  }, 1000);
}

function showOnboardingOverlay() {
  console.log("📖 Showing onboarding step:", currentOnboardingStep);
  const overlay = document.getElementById("onboardingOverlay");
  const step = onboardingSteps[currentOnboardingStep];
  
  if (!overlay || !step) {
    console.error("❌ Onboarding overlay or step not found");
    return;
  }
  
  // Update content
  document.getElementById("onboardingTitle").textContent = step.title;
  document.getElementById("onboardingText").textContent = step.text;
  document.getElementById("onboardingButton").textContent = step.button;
  
  // Show overlay
  overlay.classList.add("active");
  
  // Add highlights and tooltips after animation
  if (step.highlight) {
    setTimeout(() => {
      highlightElement(step.highlight);
      if (step.tooltip) {
        showTooltip(step.tooltip.element, step.tooltip.text);
      }
    }, 300);
  }
}

function nextOnboardingStep() {
  console.log("▶️ Next onboarding step");
  clearHighlights();
  hideTooltip();
  
  if (currentOnboardingStep < onboardingSteps.length - 1) {
    currentOnboardingStep++;
    
    // Progressive disclosure
    if (currentOnboardingStep === 4) {
      // Show focus areas
      document.querySelectorAll(".focus-chip, .focus-selection-prompt").forEach(element => {
        element.classList.remove("onboarding-hidden");
      });
    }
    
    if (currentOnboardingStep === 5) {
      // Show leaderboard
      const leaderboard = document.querySelector(".leaderboard");
      if (leaderboard) leaderboard.classList.remove("onboarding-hidden");
      const historyBtn = document.querySelector(".history-button");
      if (historyBtn) historyBtn.classList.remove("onboarding-hidden");
    }
    
    setTimeout(() => showOnboardingOverlay(), 100);
  } else {
    completeOnboarding();
  }
}

function skipOnboarding() {
  if (confirm("Skip the tutorial? You can always access help from the settings menu.")) {
    completeOnboarding();
  }
}

function completeOnboarding() {
  console.log("✅ Completing onboarding");
  const overlay = document.getElementById("onboardingOverlay");
  overlay.classList.remove("active");
  clearHighlights();
  hideTooltip();
  showAllElements();
  
  // Mark as completed
  localStorage.setItem("onboardingCompleted", "true");
  onboardingCompleted = true;
  
  // Show success message
  setTimeout(() => {
    showTooltip("#wallet-display", "Great! Start tracking your commitments now!");
    setTimeout(hideTooltip, 3000);
  }, 500);
}

function hideNonEssentialElements() {
  // Hide elements that aren't immediately needed during onboarding
  const elementsToHide = [
    ".leaderboard",
    ".history-button",
    ".focus-chips",
    ".focus-selection-prompt"
  ];
  
  elementsToHide.forEach(selector => {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add("onboarding-hidden");
    }
  });
}

function showAllElements() {
  document.querySelectorAll(".onboarding-hidden").forEach(element => {
    element.classList.remove("onboarding-hidden");
  });
}

function highlightElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.classList.add("onboarding-highlight");
  } else {
    console.warn("⚠️ Highlight element not found:", selector);
  }
}

function clearHighlights() {
  document.querySelectorAll(".onboarding-highlight").forEach(element => {
    element.classList.remove("onboarding-highlight");
  });
}

function showTooltip(elementSelector, text) {
  const tooltip = document.getElementById("tooltip");
  const targetElement = document.querySelector(elementSelector);
  
  if (!targetElement || !tooltip) {
    console.warn("⚠️ Tooltip target or tooltip element not found:", elementSelector);
    return;
  }
  
  const rect = targetElement.getBoundingClientRect();
  tooltip.textContent = text;
  tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + "px";
  tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + "px";
  tooltip.classList.add("active");
}

function hideTooltip() {
  const tooltip = document.getElementById("tooltip");
  if (tooltip) {
    tooltip.classList.remove("active");
  }
}

// Make onboarding functions globally available for onclick handlers
window.nextOnboardingStep = nextOnboardingStep;
window.skipOnboarding = skipOnboarding;

// Initialize onboarding when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
  // Initialize onboarding system
  initOnboarding();
});


// Add O key to reset onboarding for testing


