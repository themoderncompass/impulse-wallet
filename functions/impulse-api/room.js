import { json } from "./_util";

// GET /impulse-api/room?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("roomCode");
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    const row = await env.DB
      .prepare("SELECT room_code, created_at FROM rooms WHERE room_code = ?")
      .bind(roomCode)
      .first();

    if (!row) return json({ error: "Room not found" }, 404);

    // Normalize response to { room: { code, created_at } }
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

    // Ensure table exists (optional safety)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id   TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        tz        TEXT NOT NULL DEFAULT 'America/Chicago',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Upsert a room: use roomCode as room_id as well (fits TEXT PK)
    await env.DB
      .prepare("INSERT OR IGNORE INTO rooms (room_id, room_code, tz, created_at) VALUES (?, ?, 'America/Chicago', CURRENT_TIMESTAMP)")
      .bind(roomCode, roomCode)
      .run();

    // Optional: record player if provided
    if (displayName) {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_code TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      await env.DB
        .prepare("INSERT OR IGNORE INTO players (room_code, name) VALUES (?, ?)")
        .bind(roomCode, displayName)
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
