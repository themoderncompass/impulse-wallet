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

    // upsert room
    await env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (code) VALUES (?)"
    ).bind(roomCode).run();

    // optional: register player
    if (displayName) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO players (room_code, name) VALUES (?, ?)"
      ).bind(roomCode, displayName).run();
    }

    const row = await env.DB
      .prepare("SELECT code, created_at FROM rooms WHERE code = ?")
      .bind(roomCode)
      .first();

    return json({ ok: true, room: row });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
