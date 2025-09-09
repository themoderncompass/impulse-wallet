// functions/impulse-api/focus.js

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const up = (s) => (s || "").trim().toUpperCase();

async function getCols(env, table) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const cols = {};
  for (const r of (info.results || [])) cols[r.name] = { notnull: !!r.notnull, pk: !!r.pk, type: r.type };
  return cols;
}

async function ensurePlayersShape(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_norm TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_user ON players(room_code, user_id)`).run();
  await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_name_norm ON players(room_code, name_norm)`).run();
}

async function ensureFocusShape(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS weekly_focus (id INTEGER PRIMARY KEY AUTOINCREMENT)`).run();

  const cols = await getCols(env, "weekly_focus");
  const add = async (name, ddl) => {
    if (!cols[name]) await env.DB.prepare(`ALTER TABLE weekly_focus ADD COLUMN ${name} ${ddl}`).run();
  };

  // New UUID-first columns (keep old ones if present; we won't delete)
  await add("room_code",   "TEXT");
  await add("player_uuid", "TEXT"); // UUID
  await add("player_name", "TEXT"); // canonical display name
  await add("week_key",    "TEXT"); // YYYY-MM-DD
  await add("areas",       "TEXT");
  await add("locked",      "INTEGER DEFAULT 1");
  await add("created_at",  "TEXT DEFAULT CURRENT_TIMESTAMP");

  // Old column seen in your file; keep it but unused now
  await add("player_id",   "TEXT");

  // One record per (room, uuid, week)
  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS u_weekly_focus_room_uuid_week
    ON weekly_focus(room_code, player_uuid, week_key)
  `).run();
}

function validWeekKey(weekKey) {
  return typeof weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(weekKey);
}

async function requireMember(env, roomCode, userId) {
  await ensurePlayersShape(env);
  const m = await env.DB.prepare(`
    SELECT user_id, name
    FROM players
    WHERE room_code = ? AND user_id = ?
    LIMIT 1
  `).bind(roomCode, userId).first();
  return m || null;
}

// GET /impulse-api/focus?roomCode=ABCDE&userId=UUID&weekKey=YYYY-MM-DD
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const roomCode = up(url.searchParams.get("roomCode"));
    const userId   = (url.searchParams.get("userId") || "").trim();
    const weekKey  = url.searchParams.get("weekKey");

    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId)   return json({ error: "userId (UUID) required" }, 401);
    if (!validWeekKey(weekKey || "")) return json({ error: "valid weekKey (YYYY-MM-DD) required" }, 400);

    await ensureFocusShape(env);

    const member = await requireMember(env, roomCode, userId);
    if (!member) {
      return json({ error: "Join the room before loading focus.", error_code: "JOIN_REQUIRED" }, 403);
    }

    const row = await env.DB.prepare(`
      SELECT week_key AS weekKey, areas, locked, player_name
      FROM weekly_focus
      WHERE room_code = ? AND player_uuid = ? AND week_key = ?
      LIMIT 1
    `).bind(roomCode, userId, weekKey).first();

    if (!row) {
      return json({
        roomCode,
        userId,
        weekKey,
        areas: [],
        locked: false,
        playerName: member.name
      });
    }

    return json({
      roomCode,
      userId,
      weekKey: row.weekKey,
      areas: JSON.parse(row.areas || "[]"),
      locked: !!row.locked,
      playerName: row.player_name ?? member.name
    });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}

// POST /impulse-api/focus  { roomCode, userId, weekKey, areas: string[] }
export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json().catch(() => ({}));
    const roomCode = up(payload.roomCode);
    const userId   = (payload.userId || "").trim();
    const weekKey  = payload.weekKey;
    const areasArr = payload.areas;

    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId)   return json({ error: "userId (UUID) required" }, 401);
    if (!validWeekKey(weekKey || "")) return json({ error: "valid weekKey (YYYY-MM-DD) required" }, 400);
    if (!Array.isArray(areasArr)) return json({ error: "areas must be an array" }, 400);

    const clean = Array.from(new Set(areasArr.map(a => String(a).trim()).filter(Boolean)));
    if (clean.length < 2 || clean.length > 3) return json({ error: "Select 2–3 areas" }, 400);

    await ensureFocusShape(env);

    const member = await requireMember(env, roomCode, userId);
    if (!member) {
      return json({ error: "Join the room before saving focus.", error_code: "JOIN_REQUIRED" }, 403);
    }

    // Enforce once per week per UUID
    const exists = await env.DB.prepare(`
      SELECT id FROM weekly_focus
      WHERE room_code = ? AND player_uuid = ? AND week_key = ?
      LIMIT 1
    `).bind(roomCode, userId, weekKey).first();

    if (exists) return json({ error: "Weekly focus already set for this week" }, 409);

    await env.DB.prepare(`
      INSERT INTO weekly_focus (room_code, player_uuid, player_name, week_key, areas, locked)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(roomCode, userId, member.name, weekKey, JSON.stringify(clean)).run();

    // optional: bump last_seen_at
    await env.DB.prepare(`
      UPDATE players SET last_seen_at = CURRENT_TIMESTAMP
      WHERE room_code = ? AND user_id = ?
    `).bind(roomCode, userId).run();

    return json({ roomCode, userId, weekKey, areas: clean, locked: true }, 201);
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}