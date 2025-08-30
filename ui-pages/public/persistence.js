// Impulse Wallet — client persistence (Option A) using roomCode
const KEY = 'iw.session';

export function saveSession({ roomCode, joinToken, role = 'member' }) {
  const payload = { roomCode, joinToken, role, ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch {}
}
