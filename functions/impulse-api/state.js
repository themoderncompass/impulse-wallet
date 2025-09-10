// functions/impulse-api/state.js
import { json, upsertWithRetry, logEvent } from "./_util.js";

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

async function ensureEntriesShape(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT
      -- columns added below if missing
    )
  `).run();

  const cols = await getCols(env, "entries");
  const add = async (name, ddl) => { if (!cols[name]) await env.DB.prepare(`ALTER TABLE entries ADD COLUMN ${name} ${ddl}`).run(); };

  await add("room_code",  "TEXT");
  await add("player_uuid","TEXT"); // required path now
  await add("player_name","TEXT");
  await add("delta",      "INTEGER DEFAULT 0");
  await add("label",      "TEXT");
  await add("created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_entries_room ON entries(room_code)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_entries_room_playeruuid ON entries(room_code, player_uuid)`).run();
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

// GET /impulse-api/state?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const roomCode = up(new URL(request.url).searchParams.get("roomCode"));
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    await ensureEntriesShape(env);

    const rows = await env.DB
      .prepare(`
        SELECT player_name AS player, delta, label, created_at
        FROM entries
        WHERE room_code = ?
        ORDER BY created_at ASC
      `)
      .bind(roomCode)
      .all();

    const history = (rows.results || []).map(r => ({
      player: r.player ?? null,
      delta: r.delta || 0,
      label: r.label ?? null,
      created_at: r.created_at
    }));

    const balance = history.reduce((s, r) => s + (r.delta || 0), 0);
    return json({ ok: true, roomCode, balance, history });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

// POST /impulse-api/state
// Body: { roomCode, entry:{ delta:number, label?:string, userId:string } }
export const onRequestPost = async ({ request, env }) => {
  try {
    const { roomCode: rc, entry } = await request.json().catch(() => ({}));
    const roomCode = up(rc);
    const userId = (entry?.userId || "").trim();

    if (!roomCode || !entry || typeof entry.delta !== "number") {
      return json({ error: "roomCode and entry{delta} required" }, 400);
    }
    if (!userId) {
      return json({ error: "userId (UUID) required", error_code: "AUTH_REQUIRED" }, 401);
    }

    await ensureEntriesShape(env);

    const member = await requireMember(env, roomCode, userId);
    if (!member) {
      return json({ error: "Join the room before posting entries.", error_code: "JOIN_REQUIRED" }, 403);
    }

    // write entry using canonical server-side name with retry logic
    await upsertWithRetry(env, `
      INSERT INTO entries (room_code, player_uuid, player_name, delta, label, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [roomCode, userId, member.name, entry.delta, entry.label ?? null]);
    
    // Log entry creation event
    await logEvent(env, 'entry_created', {
      roomCode,
      userId,
      delta: entry.delta,
      label: entry.label,
      playerName: member.name
    });

    // optional: refresh last_seen_at for the member with retry logic
    await upsertWithRetry(env, `
      UPDATE players SET last_seen_at = CURRENT_TIMESTAMP
      WHERE room_code = ? AND user_id = ?
    `, [roomCode, userId]);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

// DELETE /impulse-api/state?roomCode=ABCDE&userId=uuid
// Undo most recent entry for this UUID in this room within 15 minutes
export const onRequestDelete = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const roomCode = up(url.searchParams.get("roomCode"));
    const userId   = (url.searchParams.get("userId") || "").trim();

    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId)   return json({ error: "userId (UUID) required", error_code: "AUTH_REQUIRED" }, 401);

    await ensureEntriesShape(env);

    const member = await requireMember(env, roomCode, userId);
    if (!member) {
      return json({ error: "Join the room before undoing entries.", error_code: "JOIN_REQUIRED" }, 403);
    }

    const row = await env.DB.prepare(`
      SELECT id, created_at
      FROM entries
      WHERE room_code = ? AND player_uuid = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(roomCode, userId).first();

    if (!row) return json({ error: "Nothing to undo" }, 404);

    const parsed = Date.parse((row.created_at || "").replace(" ", "T") + "Z");
    if (!Number.isFinite(parsed)) return json({ error: "Bad timestamp on last entry" }, 500);

    const fifteenMs = 15 * 60 * 1000;
    if (Date.now() - parsed > fifteenMs) {
      return json({ error: "Undo window elapsed (15 min)" }, 400);
    }

    await upsertWithRetry(env, `DELETE FROM entries WHERE id = ?`, [row.id]);
    
    // Log entry deletion event
    await logEvent(env, 'entry_deleted', {
      roomCode,
      userId,
      entryId: row.id,
      deletedAt: new Date().toISOString()
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
