import { json } from "./_util";

// GET /impulse-api/state?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("roomCode");
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      player TEXT,
      delta INTEGER NOT NULL,
      label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    const rows = await env.DB
      .prepare("SELECT player, delta, label, created_at FROM entries WHERE room_code = ? ORDER BY created_at ASC")
      .bind(roomCode).all();

    const history = rows.results || [];
    const balance = history.reduce((s, r) => s + (r.delta ?? 0), 0);
    return json({ ok: true, roomCode, balance, history });
  } catch (e) {
    console.error("state GET error:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
};

// POST /impulse-api/state { roomCode, entry:{ delta, label?, player? } }
export const onRequestPost = async ({ request, env }) => {
  try {
    const { roomCode, entry } = await request.json().catch(() => ({}));
    if (!roomCode || !entry || typeof entry.delta !== "number") {
      return json({ error: "roomCode and entry{delta} required" }, 400);
    }

    await env.DB.prepare("INSERT OR IGNORE INTO rooms (code) VALUES (?)")
      .bind(roomCode).run();

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      player TEXT,
      delta INTEGER NOT NULL,
      label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    await env.DB.prepare(
      "INSERT INTO entries (room_code, player, delta, label, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
    ).bind(roomCode, entry.player ?? null, entry.delta, entry.label ?? null).run();

    return json({ ok: true });
  } catch (e) {
    console.error("state POST error:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
};
