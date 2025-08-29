// ===== Impulse Wallet — frontend (Pages Functions contract) =====
// API base (Pages). No Worker domain, no CORS headaches.
const API_BASE = "/impulse-api";

// --- audio (optional feedback) ---
const SOUND_GOOD = "https://cdn.pixabay.com/download/audio/2022/08/02/audio_2a1f1b.mp3?filename=new-notification-017-352293.mp3";
const SOUND_BAD  = "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0a2e6b.mp3?filename=windows-error-sound-effect-35894.mp3";
let audioEnabled = false;
const sndGood = new Audio(SOUND_GOOD), sndBad = new Audio(SOUND_BAD);
document.addEventListener("click", () => { audioEnabled = true; }, { once: true });

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
  csv: $("#csv")
};

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

// --- state ---
let roomCode = null;
let displayName = "";

// --- render ---
function paint(state) {
  // state: { ok, roomCode, balance, history:[{player,delta,label,created_at}] }
  const history = Array.isArray(state.history) ? state.history : [];

  // Leaderboard by player total
  const totals = {};
  for (const r of history) {
    const p = r.player || "—";
    totals[p] = (totals[p] || 0) + (r.delta || 0);
  }
  el.board.innerHTML = "";
  Object.entries(totals).sort((a, b) => b[1] - a[1]).forEach(([name, bal]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${h(name)}</td><td>${bal}</td><td>—</td><td>—</td>`;
    el.board.appendChild(tr);
  });

  // My history (latest first)
  el.mine.innerHTML = "";
  history.slice().reverse().forEach(row => {
    const tr = document.createElement("tr");
    const when = row.created_at ? new Date(row.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "";
    tr.innerHTML = `<td>${h(when)}</td><td>${row.delta > 0 ? "+$1" : "-$1"}</td><td>${h(row.label || "")}</td><td>${h(row.player || "")}</td>`;
    el.mine.appendChild(tr);
  });

  // Optional banner logic (simple milestones)
  if (totals[displayName] >= 20) show("You hit +$20 this week. Keep going.");
  if (totals[displayName] <= -20) show("You hit −$20 this week. Keep tracking.", true);
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
    $(".join")?.classList.add("hidden");
    el.play.classList.remove("hidden");
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
    // Ensure room exists (GET /room)
    await api(`/room?roomCode=${encodeURIComponent(roomCode)}`);
    $(".join")?.classList.add("hidden");
    el.play.classList.remove("hidden");
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
    const impulse = (el.impulse.value || "").trim();
    await api("/state", {
      method: "POST",
      body: JSON.stringify({ roomCode, entry: { delta: amount, label: impulse, player: displayName } })
    });
    el.impulse.value = "";
    await refresh();
    if (audioEnabled) {
      try {
        const s = amount === 1 ? sndGood : sndBad;
        s.currentTime = 0; s.play();
      } catch {}
    }
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

// --- background refresh ---
setInterval(() => { refresh(); }, 5000);
