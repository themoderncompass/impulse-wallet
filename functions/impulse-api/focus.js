// functions/impulse-api/focus.js
import { json } from "./util";

async function getCols(env, table) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const cols = {};
  for (const r of (info.results || [])) cols[r.name] = { notnull: !!r.notnull, pk: !!r.pk, type: r.type };
  return cols;
}

async function ensureFocusShape(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS weekly_focus (
      id INTEGER PRIMARY KEY AUTOINCREMENT
      -- columns added below if missing
    )
  `).run();

  const cols = await getCols(env, "weekly_focus");
  const add = async (name, ddl) => { if (!cols[name]) await env.DB.prepare(`ALTER TABLE weekly_focus ADD COLUMN ${name} ${ddl}`).run(); };

  await add("room_code",   "TEXT");                         // scope to room (matches entries table usage)
  await add("player_id",   "TEXT");                         // stable id derived from room+player name (or your real user id)
  await add("player_name", "TEXT");                         // optional display
  await add("week_key",    "TEXT");                         // "YYYY-MM-DD" for Monday 12:01 boundary
  await add("areas",       "TEXT");                         // JSON array
  await add("locked",      "INTEGER DEFAULT 1");            // always 1 once saved
  await add("created_at",  "TEXT DEFAULT CURRENT_TIMESTAMP");

  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_focus_user_week
    ON weekly_focus(room_code, player_id, week_key)
  `).run();
}

function validWeekKey(weekKey) {
  return typeof weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(weekKey);
}

// Same pid rule used in state.js for entries
function derivePid(roomCode, playerName) {
  return `${roomCode}:${playerName ?? "anon"}`;
}

/*
GET /impulse-api/focus?roomCode=ABCDE&player=Josh&weekKey=YYYY-MM-DD

Response:
{ roomCode, player, playerId, weekKey, areas: string[], locked: boolean }
*/
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("roomCode");
    const player   = url.searchParams.get("player") || null;
    const weekKey  = url.searchParams.get("weekKey");

    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!validWeekKey(weekKey || "")) return json({ error: "valid weekKey (YYYY-MM-DD) required" }, 400);

    await ensureFocusShape(env);

    const pid = derivePid(roomCode, player);
    const row = await env.DB
      .prepare(`SELECT week_key AS weekKey, areas, locked, player_name FROM weekly_focus WHERE room_code = ? AND player_id = ? AND week_key = ?`)
      .bind(roomCode, pid, weekKey)
      .first();

    if (!row) {
      return json({ roomCode, player, playerId: pid, weekKey, areas: [], locked: false });
    }

    return json({
      roomCode,
      player: row.player_name ?? player,
      playerId: pid,
      weekKey: row.weekKey,
      areas: JSON.parse(row.areas || "[]"),
      locked: !!row.locked
    });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}

/*
POST /impulse-api/focus
Body: { roomCode, player, weekKey, areas: string[] }

Creates the week's focus for this user, locks immediately.
409 if already set
