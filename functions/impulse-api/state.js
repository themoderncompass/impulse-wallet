// functions/impulse-api/state.js
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function getEntriesCols(env) {
  const info = await env.DB.prepare(`PRAGMA table_info(entries)`).all();
  const cols = (info.results || []).reduce((m, r) => {
    m[r.name] = { notnull: !!r.notnull, pk: !!r.pk, type: r.type };
    return m;
  }, {});
  return cols;
}

// Create table if missing and add common columns we depend on
async function ensureEntriesShape(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `).run();

  const cols = await getEntriesCols(env);

  if (!cols.room_code)  await env.DB.prepare(`ALTER TABLE entries ADD COLUMN room_code TEXT`).run();
  if (!cols.room_id)    await env.DB.prepare(`ALTER TABLE entries ADD COLUMN room_id TEXT`).run(); // tolerate legacy schemas
  if (!cols.player)     await env.DB.prepare(`ALTER TABLE entries ADD COLUMN player TEXT`).run();
  if (!cols.delta)      await env.DB.prepare(`ALTER TABLE entries ADD COLUMN delta INTEGER DEFAULT 0`).run();
  if (!cols.label)      await env.DB.prepare(`ALTER TABLE entries ADD COLUMN label TEXT`).run();
  if (!cols.created_at) await env.DB.prepare(`ALTER TABLE entries ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`).run();
}

// GET /impulse-api/state?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const roomCode = new URL(request.url).searchParams.get("roomCode");
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    await ensureEntriesShape(env);

    const rows = await env.DB
      .prepare(
        "SELECT player, delta, label, created_at FROM entries WHERE room_code = ? OR room_id = ? ORDER BY created_at ASC"
      )
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

    // Build an INSERT that satisfies whichever columns exist (including NOT NULL room_id)
    const cols = await getEntriesCols(env);
    const fields = [];
    const binds = [];

    // set both if present
    if (cols.room_code) { fields.push("room_code"); binds.push(roomCode); }
    if (cols.room_id)   { fields.push("room_id");   binds.push(roomCode); }

    fields.push("player");     binds.push(entry.player ?? null);
    fields.push("delta");      binds.push(entry.delta);
    fields.push("label");      binds.push(entry.label ?? null);

    const placeholders = fields.map(() => "?").join(", ");
    const sql = `INSERT INTO entries (${fields.join(", ")}, created_at) VALUES (${placeholders}, CURRENT_TIMESTAMP)`;

    await env.DB.prepare(sql).bind(...binds).run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
