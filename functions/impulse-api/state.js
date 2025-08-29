// functions/impulse-api/state.js
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function getCols(env, table) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const cols = {};
  for (const r of (info.results || [])) cols[r.name] = { notnull: !!r.notnull, pk: !!r.pk, type: r.type };
  return cols;
}

async function ensureEntriesShape(env) {
  // Create table if it doesn't exist; we won't DROP anything.
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT
      -- we add columns below if missing
    )
  `).run();

  const cols = await getCols(env, "entries");
  const add = async (name, ddl) => { if (!cols[name]) await env.DB.prepare(`ALTER TABLE entries ADD COLUMN ${name} ${ddl}`).run(); };

  // Make sure these columns exist. We won't change NOT NULL flags on existing columns.
  await add("room_code",  "TEXT");
  await add("room_id",    "TEXT");
  await add("player_id",  "TEXT"); // present in your players table; sometimes schemas add this to entries too
  await add("player",     "TEXT");
  await add("delta",      "INTEGER DEFAULT 0");
  await add("label",      "TEXT");
  await add("created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
}

// GET /impulse-api/state?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const roomCode = new URL(request.url).searchParams.get("roomCode");
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    await ensureEntriesShape(env);
    const rows = await env.DB
      .prepare(`
        SELECT player, delta, label, created_at
        FROM entries
        WHERE room_code = ? OR room_id = ?
        ORDER BY created_at ASC
      `)
      .bind(roomCode, roomCode)
      .all();

    const history = rows.results || [];
    const balance = history.reduce((s, r) => s + (r.delta || 0), 0);
    return json({ ok: true, roomCode, balance, history });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

// POST /impulse-api/state  { roomCode, entry:{ delta, label?, player? } }
export const onRequestPost = async ({ request, env }) => {
  try {
    const { roomCode, entry } = await request.json().catch(() => ({}));
    if (!roomCode || !entry || typeof entry.delta !== "number") {
      return json({ error: "roomCode and entry{delta} required" }, 400);
    }

    await ensureEntriesShape(env);

    const cols = await getCols(env, "entries");
    const fields = [];
    const binds  = [];

    // Satisfy whichever room columns exist (and any NOT NULL constraints)
    if (cols.room_code) { fields.push("room_code"); binds.push(roomCode); }
    if (cols.room_id)   { fields.push("room_id");   binds.push(roomCode); }

    // Player fields
    const playerName = entry.player ?? null;
    if (cols.player_id) {
      // stable id from room+name; avoids NULL when NOT NULL constraint exists
      const pid = `${roomCode}:${playerName ?? "anon"}`;
      fields.push("player_id"); binds.push(pid);
    }
    if (cols.player) { fields.push("player"); binds.push(playerName); }

    // Other data
    if (cols.delta) { fields.push("delta"); binds.push(entry.delta); }
    if (cols.label) { fields.push("label"); binds.push(entry.label ?? null); }

    const placeholders = fields.map(() => "?").join(", ");
    const sql = `INSERT INTO entries (${fields.join(", ")}, created_at) VALUES (${placeholders}, CURRENT_TIMESTAMP)`;
    await env.DB.prepare(sql).bind(...binds).run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
