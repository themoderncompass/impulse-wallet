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

    const pid
