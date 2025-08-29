// functions/impulse-api/focus.js

// Local json helper (avoid cross-file imports)
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function getCols(env, table) {
  const info = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  const cols = {};
  for (const r of (info.results || [])) cols[r.name] = { notnull: !!r.notnull, pk: !!r.pk, type: r.type };
  return cols;
}

async function ensureFocusShape(env) {
  // Base table
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS weekly_focus (id INTEGER PRIMARY KEY AUTOINCREMENT)').run();

  const cols = await getCols(env, 'weekly_focus');
  const add = async (name, ddl) => {
    if (!cols[name]) await env.DB.prepare('ALTER TABLE weekly_focus ADD COLUMN ' + name + ' ' + ddl).run();
  };

  await add('room_code',   'TEXT');
  await add('player_id',   'TEXT');
  await add('player_name', 'TEXT');
  await add('week_key',    'TEXT');
  await add('areas',       'TEXT');
  await add('locked',      'INTEGER DEFAULT 1');
  await add('created_at',  'TEXT DEFAULT CURRENT_TIMESTAMP');

  // Uniqueness per (room_code, player_id, week_key)
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_focus_user_week ON weekly_focus(room_code, player_id, week_key)').run();
}

function validWeekKey(weekKey) {
  return typeof weekKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekKey);
}

function derivePid(roomCode, playerName) {
  return (roomCode || '') + ':' + (playerName ?? 'anon');
}

// GET /impulse-api/focus?roomCode=ABCDE&player=Josh&weekKey=YYYY-MM-DD
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get('roomCode');
    const player   = url.searchParams.get('player') || null;
    const weekKey  = url.searchParams.get('weekKey');

    if (!roomCode) return json({ error: 'roomCode required' }, 400);
    if (!validWeekKey(weekKey || '')) return json({ error: 'valid weekKey (YYYY-MM-DD) required' }, 400);

    await ensureFocusShape(env);

    const pid = derivePid(roomCode, player);
    const row = await env.DB
      .prepare('SELECT week_key AS weekKey, areas, locked, player_name FROM weekly_focus WHERE room_code = ? AND player_id = ? AND week_key = ?')
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
      areas: JSON.parse(row.areas || '[]'),
      locked: !!row.locked
    });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}

// POST /impulse-api/focus  body: { roomCode, player, weekKey, areas: string[] }
export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json().catch(() => ({}));
    const roomCode = payload.roomCode;
    const player   = payload.player || null;
    const weekKey  = payload.weekKey;
    const areasArr = payload.areas;

    if (!roomCode) return json({ error: 'roomCode required' }, 400);
    if (!validWeekKey(weekKey || '')) return json({ error: 'valid weekKey (YYYY-MM-DD) required' }, 400);
    if (!Array.isArray(areasArr)) return json({ error: 'areas must be an array' }, 400);

    const clean = Array.from(new Set(areasArr.map(a => String(a).trim()).filter(Boolean)));
    if (clean.length < 2 || clean.length > 3) return json({ error: 'Select 2–3 areas' }, 400);

    await ensureFocusShape(env);

    const pid = derivePid(roomCode, player);
    const exists = await env.DB
      .prepare('SELECT id FROM weekly_focus WHERE room_code = ? AND player_id = ? AND week_key = ?')
      .bind(roomCode, pid, weekKey)
      .first();

    if (exists) return json({ error: 'Weekly focus already set for this week' }, 409);

    await env.DB
      .prepare('INSERT INTO weekly_focus (room_code, player_id, player_name, week_key, areas, locked) VALUES (?, ?, ?, ?, ?, 1)')
      .bind(roomCode, pid, player ?? null, weekKey, JSON.stringify(clean))
      .run();

    return json({ roomCode, player, playerId: pid, weekKey, areas: clean, locked: true }, 201);
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
