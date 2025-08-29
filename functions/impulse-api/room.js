// Minimal JSON helper (avoid Response.json compatibility surprises)
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// GET /impulse-api/room?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const roomCode = new URL(request.url).searchParams.get("roomCode");
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    const row = await env.DB
      .prepare("SELECT room_code, created_at FROM rooms WHERE room_code = ?")
      .bind(roomCode)
      .first();

    if (!row) return json({ error: "Room not found" }, 404);
    return json({ ok: true, room: { code: row.room_code, created_at: row.created_at } });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

// POST /impulse-api/room  { roomCode, displayName? }
export const onRequestPost = async ({ request, env }) => {
  try {
    const { roomCode, displayName } = await request.json().catch(() => ({}));
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    // Your schema: rooms(room_id, room_code, tz, created_at)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id   TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        tz        TEXT NOT NULL DEFAULT 'America/Chicago',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Upsert room using code for both id and code (idempotent)
    await env.DB
      .prepare("INSERT OR IGNORE INTO rooms (room_id, room_code) VALUES (?, ?)")
      .bind(roomCode, roomCode)
      .run();

    // players table per your schema: players(player_id, room_id, display_name, created_at, room_code)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS players (
        player_id   TEXT PRIMARY KEY,
        room_id     TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        room_code   TEXT
      )
    `).run();

    if (displayName) {
      // Use a stable player_id = roomCode:displayName (simple de-dupe)
      const pid = `${roomCode}:${displayName}`;
      await env.DB
        .prepare("INSERT OR IGNORE INTO players (player_id, room_id, display_name, room_code) VALUES (?, ?, ?, ?)")
        .bind(pid, roomCode, displayName, roomCode)
        .run();
    }

    const row = await env.DB
      .prepare("SELECT room_code, created_at FROM rooms WHERE room_code = ?")
      .bind(roomCode)
      .first();

    return json({ ok: true, room: { code: row.room_code, created_at: row.created_at } });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
