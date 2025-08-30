// functions/impulse-api/room.js
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// GET /impulse-api/room?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("roomCode");
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    const row = await env.DB
      .prepare("SELECT code, created_at FROM rooms WHERE code = ?")
      .bind(roomCode)
      .first();

    if (!row) return json({ error: "Room not found" }, 404);
    return json({ ok: true, room: row });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

// POST /impulse-api/room  { roomCode, displayName? }
export const onRequestPost = async ({ request, env }) => {
  try {
    const { roomCode, displayName } = await request.json().catch(() => ({}));
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    // ensure tables exist (idempotent)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_code TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // session table for persistence
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS room_sessions (
        join_token TEXT PRIMARY KEY,
        room_code  TEXT NOT NULL,
        role       TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
      )
    `).run();

    await env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (code) VALUES (?)"
    ).bind(roomCode).run();

    if (displayName) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO players (room_code, name) VALUES (?, ?)"
      ).bind(roomCode, displayName).run();
    }

    // mint a session token for this device/browser
    const joinToken = crypto.randomUUID();
    const ttlMs = 1000 * 60 * 60 * 12; // 12 hours
    const role = "member";

    await env.DB.prepare(`
      INSERT INTO room_sessions (join_token, room_code, role, expires_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(join_token) DO UPDATE SET
        room_code = excluded.room_code,
        role = excluded.role,
        expires_at = excluded.expires_at
    `).bind(joinToken, roomCode, role, Date.now() + ttlMs).run();

    const row = await env.DB
      .prepare("SELECT code, created_at FROM rooms WHERE code = ?")
      .bind(roomCode)
      .first();

    // return joinToken + roomCode so client can persist
    return json({ ok: true, room: row, roomCode, role, joinToken });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
