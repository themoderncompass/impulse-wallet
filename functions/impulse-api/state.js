function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// Make sure entries has the columns we’ll read/write (non-destructive ADD COLUMNs)
async function ensureEntriesShape(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT
      -- other columns added below if missing
    )
  `).run();

  // Add columns if missing (SQLite allows ADD COLUMN without touching existing data)
  const cols = await env.DB.prepare(`PRAGMA table_info(entries)`).all();
  const has = (name) => (cols.results || []).some(c => c.name === name);

  if (!has("room_code"))   await env.DB.prepare(`ALTER TABLE entries ADD COLUMN room_code TEXT`).run();
  if (!has("player"))      await env.DB.prepare(`ALTER TABLE entries ADD COLUMN player TEXT`).run();
  if (!has("delta"))       await env.DB.prepare(`ALTER TABLE entries ADD COLUMN delta INTEGER DEFAULT 0`).run();
  if (!has("label"))       await env.DB.prepare(`ALTER TABLE entries ADD COLUMN label TEXT`).run();
  if (!has("created_at"))  await env.DB.prepare(`ALTER TABLE entries ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`).run();
}

// GET /impulse-api/state?roomCode=ABCDE
export const onRequestGet = async ({ request, env }) => {
  try {
    const roomCode = new URL(request.url).searchParams.get("roomCode");
    if (!roomCode) return json({ error: "roomCode required" }, 400);

    await ensureEntriesShape(env);

    const rows = await env.DB
      .prepare(
        "SELECT player, delta, label, created_at FROM entries WHERE room_code = ? ORDER BY created_at ASC"
      )
      .bind(roomCode)
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

    await env.DB
      .prepare(
        "INSERT INTO entries (room_code, player, delta, label, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
      )
      .bind(roomCode, entry.player ?? null, entry.delta, entry.label ?? null)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
