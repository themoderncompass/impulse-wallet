// functions/impulse-api/room.js
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// small helper: normalize names for case-insensitive dedupe
const norm = (s) => (s || "").trim().toLowerCase();

// Ensure/upgrade schema (idempotent). Call at the start of GET/POST.
async function ensureSchema(env) {
  // rooms table (codes stored UPPERCASE by us)
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // players is effectively "room_members" (one row per player per room)
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      user_id TEXT NOT NULL,          -- UUID from client
      name TEXT NOT NULL,             -- display name as shown to users
      name_norm TEXT,                 -- normalized for case-insensitive uniqueness
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // add missing columns/indexes safely (no-ops if exist)
  await env.DB.prepare(`PRAGMA foreign_keys = ON`).run();

  // name_norm column may not exist in older tables
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_players_room_user ON players(room_code, user_id)
  `).run();
  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_user ON players(room_code, user_id)
  `).run();

  // unique display name per room (case-insensitive via name_norm)
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_players_room_name_norm ON players(room_code, name_norm)
  `).run();
  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_name_norm ON players(room_code, name_norm)
  `).run();
}

// GET /impulse-api/room?roomCode=ABCDE&displayName=Josh&userId=uuid
// Used to validate room existence and (optionally) pre-check name dedupe
export const onRequestGet = async ({ request, env }) => {
  try {
    await ensureSchema(env);

    const url = new URL(request.url);
    const roomCodeRaw = url.searchParams.get("roomCode") || "";
    const roomCode = roomCodeRaw.trim().toUpperCase();  // canonicalize
    const displayName = (url.searchParams.get("displayName") || "").trim();
    const userId = (url.searchParams.get("userId") || "").trim();

    if (!roomCode) return json({ error: "roomCode required" }, 400);

    const room = await env.DB
      .prepare("SELECT code, created_at FROM rooms WHERE code = ?")
      .bind(roomCode)
      .first();

    if (!room) return json({ error: "Room not found" }, 404);

    if (displayName && userId) {
      const nameNorm = norm(displayName);
      // Is this name already taken by a different UUID in this room?
      const taken = await env.DB
        .prepare(`
          SELECT user_id FROM players
          WHERE room_code = ? AND name_norm = ?
          LIMIT 1
        `)
        .bind(roomCode, nameNorm)
        .first();

      if (taken && taken.user_id !== userId) {
        return json({
          error: `The name "${displayName}" is already taken in this room. Please choose a different name.`,
          error_code: "DUPLICATE_NAME"
        }, 409);
      }
    }

    return json({ ok: true, room });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

// POST /impulse-api/room { roomCode, displayName?, userId? }
// - Ensures room exists
// - If displayName+userId provided: claims/updates membership idempotently
export const onRequestPost = async ({ request, env }) => {
  try {
    await ensureSchema(env);

    const body = await request.json().catch(() => ({}));
    const roomCodeRaw = body?.roomCode || "";
    const roomCode = roomCodeRaw.trim().toUpperCase();  // canonicalize
    const displayName = (body?.displayName || "").trim();
    const userId = (body?.userId || "").trim();

    if (!roomCode) return json({ error: "roomCode required" }, 400);

    // Upsert room
    await env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (code) VALUES (?)"
    ).bind(roomCode).run();

    // If the client provided a name, claim/update membership for this UUID
    if (displayName) {
      if (!userId) return json({ error: "userId required when displayName is provided" }, 400);

      const nameNorm = norm(displayName);

      // Pre-check duplicate name owned by a different UUID (friendly 409)
      const existingByName = await env.DB
        .prepare(`
          SELECT user_id FROM players
          WHERE room_code = ? AND name_norm = ?
          LIMIT 1
        `)
        .bind(roomCode, nameNorm)
        .first();

      if (existingByName && existingByName.user_id !== userId) {
        return json({
          error: `The name "${displayName}" is already taken in this room. Please choose a different name.`,
          error_code: "DUPLICATE_NAME"
        }, 409);
      }

      // Idempotent membership UPSERT keyed by (room_code, user_id)
      await env.DB.prepare(`
        INSERT INTO players (room_code, user_id, name, name_norm)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(room_code, user_id) DO UPDATE SET
          name = excluded.name,
          name_norm = excluded.name_norm,
          last_seen_at = CURRENT_TIMESTAMP
      `).bind(roomCode, userId, displayName, nameNorm).run();
    }

    const room = await env.DB
      .prepare("SELECT code, created_at FROM rooms WHERE code = ?")
      .bind(roomCode)
      .first();

    return json({ ok: true, room });
  } catch (e) {
    // If a race sneaks past the pre-check, surface a clean 409
    const msg = e?.message || String(e);
    if (msg.includes("u_players_room_name_norm")) {
      return json({
        error: "Display name already taken in this room.",
        error_code: "DUPLICATE_NAME"
      }, 409);
    }
    return json({ error: msg }, 500);
  }
};
