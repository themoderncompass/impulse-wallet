var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-Y2Njdo/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/pages-yKdVed/functionsWorker-0.42732680892103736.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var urls2 = /* @__PURE__ */ new Set();
function checkURL2(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls2.has(url.toString())) {
      urls2.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL2, "checkURL");
__name2(checkURL2, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL2(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization"
    }
  });
}
__name(json, "json");
__name2(json, "json");
async function upsertWithRetry(env, query, bindings, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await env.DB.prepare(query).bind(...bindings).run();
      return result;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const msg = error.message.toLowerCase();
      if (msg.includes("locked") || msg.includes("busy") || msg.includes("constraint")) {
        await new Promise((resolve) => setTimeout(resolve, 10 * Math.pow(4, attempt - 1)));
        continue;
      }
      throw error;
    }
  }
}
__name(upsertWithRetry, "upsertWithRetry");
__name2(upsertWithRetry, "upsertWithRetry");
async function logEvent(env, eventType, data = {}) {
  try {
    const event = {
      type: eventType,
      data,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      id: crypto.randomUUID()
    };
    await upsertWithRetry(env, `
      INSERT INTO events (id, type, data, created_at)
      VALUES (?, ?, ?, ?)
    `, [event.id, eventType, JSON.stringify(data), event.timestamp]);
    return event;
  } catch (error) {
    console.error("Event logging failed:", error);
    return null;
  }
}
__name(logEvent, "logEvent");
__name2(logEvent, "logEvent");
var up = /* @__PURE__ */ __name2((s) => (s || "").trim().toUpperCase(), "up");
async function ensureEventsTable(env) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        room_code TEXT,
        user_id TEXT,
        data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (error) {
    console.error("Failed to ensure events table:", error);
  }
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_events_room ON events(room_code)
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)
  `).run();
}
__name(ensureEventsTable, "ensureEventsTable");
__name2(ensureEventsTable, "ensureEventsTable");
async function onRequestGet({ request, env }) {
  try {
    await ensureEventsTable(env);
    const url = new URL(request.url);
    const roomCode = up(url.searchParams.get("roomCode") || "");
    const eventType = url.searchParams.get("type");
    const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
    let query = `SELECT id, type, room_code, user_id, data, created_at FROM events WHERE 1=1`;
    const bindings = [];
    if (roomCode) {
      query += ` AND room_code = ?`;
      bindings.push(roomCode);
    }
    if (eventType) {
      query += ` AND type = ?`;
      bindings.push(eventType);
    }
    query += ` ORDER BY created_at DESC LIMIT ?`;
    bindings.push(limit);
    const result = await env.DB.prepare(query).bind(...bindings).all();
    const events = (result.results || []).map((row) => ({
      id: row.id,
      type: row.type,
      roomCode: row.room_code,
      userId: row.user_id,
      data: row.data ? JSON.parse(row.data) : {},
      createdAt: row.created_at
    }));
    return json({ ok: true, events, count: events.length });
  } catch (error) {
    console.error("Events fetch error:", error);
    return json({ error: error.message || "Failed to fetch events" }, 500);
  }
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
async function onRequestPost({ request, env }) {
  try {
    await ensureEventsTable(env);
    const body = await request.json().catch(() => ({}));
    const { type, roomCode, userId, data = {} } = body;
    if (!type) {
      return json({ error: "Event type is required" }, 400);
    }
    const event = await logEvent(env, type, {
      ...data,
      roomCode: roomCode ? up(roomCode) : void 0,
      userId
    });
    if (!event) {
      return json({ error: "Failed to log event" }, 500);
    }
    return json({ ok: true, event }, 201);
  } catch (error) {
    console.error("Event creation error:", error);
    return json({ error: error.message || "Failed to create event" }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
var up2 = /* @__PURE__ */ __name2((s) => (s || "").trim().toUpperCase(), "up");
async function getCols(env, table) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const cols = {};
  for (const r of info.results || []) cols[r.name] = { notnull: !!r.notnull, pk: !!r.pk, type: r.type };
  return cols;
}
__name(getCols, "getCols");
__name2(getCols, "getCols");
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
__name(ensurePlayersShape, "ensurePlayersShape");
__name2(ensurePlayersShape, "ensurePlayersShape");
async function ensureFocusShape(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS weekly_focus (id INTEGER PRIMARY KEY AUTOINCREMENT)`).run();
  const cols = await getCols(env, "weekly_focus");
  const add = /* @__PURE__ */ __name2(async (name, ddl) => {
    if (!cols[name]) await env.DB.prepare(`ALTER TABLE weekly_focus ADD COLUMN ${name} ${ddl}`).run();
  }, "add");
  await add("room_code", "TEXT");
  await add("player_uuid", "TEXT");
  await add("player_name", "TEXT");
  await add("week_key", "TEXT");
  await add("areas", "TEXT");
  await add("locked", "INTEGER DEFAULT 1");
  await add("created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await add("player_id", "TEXT");
  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS u_weekly_focus_room_uuid_week
    ON weekly_focus(room_code, player_uuid, week_key)
  `).run();
}
__name(ensureFocusShape, "ensureFocusShape");
__name2(ensureFocusShape, "ensureFocusShape");
function validWeekKey(weekKey) {
  return typeof weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(weekKey);
}
__name(validWeekKey, "validWeekKey");
__name2(validWeekKey, "validWeekKey");
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
__name(requireMember, "requireMember");
__name2(requireMember, "requireMember");
async function onRequestGet2({ request, env }) {
  try {
    const url = new URL(request.url);
    const roomCode = up2(url.searchParams.get("roomCode"));
    const userId = (url.searchParams.get("userId") || "").trim();
    const weekKey = url.searchParams.get("weekKey");
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId) return json({ error: "userId (UUID) required" }, 401);
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
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
async function onRequestPost2({ request, env }) {
  try {
    const payload = await request.json().catch(() => ({}));
    const roomCode = up2(payload.roomCode);
    const userId = (payload.userId || "").trim();
    const weekKey = payload.weekKey;
    const areasArr = payload.areas;
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId) return json({ error: "userId (UUID) required" }, 401);
    if (!validWeekKey(weekKey || "")) return json({ error: "valid weekKey (YYYY-MM-DD) required" }, 400);
    if (!Array.isArray(areasArr)) return json({ error: "areas must be an array" }, 400);
    const clean = Array.from(new Set(areasArr.map((a) => String(a).trim()).filter(Boolean)));
    if (clean.length < 2 || clean.length > 3) return json({ error: "Select 2\u20133 areas" }, 400);
    await ensureFocusShape(env);
    const member = await requireMember(env, roomCode, userId);
    if (!member) {
      return json({ error: "Join the room before saving focus.", error_code: "JOIN_REQUIRED" }, 403);
    }
    const exists = await env.DB.prepare(`
      SELECT id FROM weekly_focus
      WHERE room_code = ? AND player_uuid = ? AND week_key = ?
      LIMIT 1
    `).bind(roomCode, userId, weekKey).first();
    if (exists) return json({ error: "Weekly focus already set for this week" }, 409);
    await upsertWithRetry(env, `
      INSERT INTO weekly_focus (room_code, player_uuid, player_name, week_key, areas, locked)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(room_code, player_uuid, week_key) DO UPDATE SET
        areas = excluded.areas,
        player_name = excluded.player_name,
        created_at = CURRENT_TIMESTAMP
    `, [roomCode, userId, member.name, weekKey, JSON.stringify(clean)]);
    await logEvent(env, "focus_set", {
      roomCode,
      userId,
      weekKey,
      areasCount: clean.length,
      playerName: member.name
    });
    await upsertWithRetry(env, `
      UPDATE players SET last_seen_at = CURRENT_TIMESTAMP
      WHERE room_code = ? AND user_id = ?
    `, [roomCode, userId]);
    return json({ roomCode, userId, weekKey, areas: clean, locked: true }, 201);
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
var onRequestGet3 = /* @__PURE__ */ __name2(async ({ env }) => {
  try {
    const r = await env.DB.prepare("select 1 as ok").first();
    return json({ ok: true, db: r?.ok === 1 });
  } catch (e) {
    console.error("health error:", e);
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}, "onRequestGet");
async function onRequestPost3({ request, env }) {
  try {
    console.log("Initializing database tables...");
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        room_code TEXT,
        user_id TEXT,
        data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_locked INTEGER DEFAULT 0,
        invite_only INTEGER DEFAULT 0,
        created_by TEXT,
        max_members INTEGER DEFAULT 50,
        invite_code TEXT
      )
    `).run();
    const addColumn = /* @__PURE__ */ __name2(async (column, definition) => {
      try {
        await env.DB.prepare(`ALTER TABLE rooms ADD COLUMN ${column} ${definition}`).run();
      } catch (e) {
      }
    }, "addColumn");
    await addColumn("is_locked", "INTEGER DEFAULT 0");
    await addColumn("invite_only", "INTEGER DEFAULT 0");
    await addColumn("created_by", "TEXT");
    await addColumn("max_members", "INTEGER DEFAULT 50");
    await addColumn("invite_code", "TEXT");
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
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_code TEXT,
        player_uuid TEXT,
        player_name TEXT,
        delta INTEGER DEFAULT 0,
        label TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS weekly_focus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_code TEXT,
        player_uuid TEXT,
        player_name TEXT,
        week_key TEXT,
        areas TEXT,
        locked INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        player_id TEXT
      )
    `).run();
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_user ON players(room_code, user_id)`).run();
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_name_norm ON players(room_code, name_norm)`).run();
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_weekly_focus_room_uuid_week ON weekly_focus(room_code, player_uuid, week_key)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_events_room ON events(room_code)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_entries_room ON entries(room_code)`).run();
    console.log("Database initialization complete!");
    return json({
      ok: true,
      message: "Database initialized successfully",
      tables: ["events", "rooms", "players", "users", "entries", "weekly_focus"]
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    return json({ error: error.message || "Database initialization failed" }, 500);
  }
}
__name(onRequestPost3, "onRequestPost3");
__name2(onRequestPost3, "onRequestPost");
var norm = /* @__PURE__ */ __name2((s) => (s || "").trim().toLowerCase(), "norm");
var generateInviteCode = /* @__PURE__ */ __name2(() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}, "generateInviteCode");
async function ensureSchema(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_locked INTEGER DEFAULT 0,
      invite_only INTEGER DEFAULT 0,
      created_by TEXT,
      max_members INTEGER DEFAULT 50,
      invite_code TEXT
    )
  `).run();
  const addColumnIfNotExists = /* @__PURE__ */ __name2(async (column, definition) => {
    try {
      await env.DB.prepare(`ALTER TABLE rooms ADD COLUMN ${column} ${definition}`).run();
    } catch (e) {
    }
  }, "addColumnIfNotExists");
  await addColumnIfNotExists("is_locked", "INTEGER DEFAULT 0");
  await addColumnIfNotExists("invite_only", "INTEGER DEFAULT 0");
  await addColumnIfNotExists("created_by", "TEXT");
  await addColumnIfNotExists("max_members", "INTEGER DEFAULT 50");
  await addColumnIfNotExists("invite_code", "TEXT");
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
  await env.DB.prepare(`PRAGMA foreign_keys = ON`).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_players_room_user ON players(room_code, user_id)
  `).run();
  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_user ON players(room_code, user_id)
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_players_room_name_norm ON players(room_code, name_norm)
  `).run();
  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_name_norm ON players(room_code, name_norm)
  `).run();
}
__name(ensureSchema, "ensureSchema");
__name2(ensureSchema, "ensureSchema");
var onRequestGet4 = /* @__PURE__ */ __name2(async ({ request, env }) => {
  try {
    await ensureSchema(env);
    const url = new URL(request.url);
    const roomCodeRaw = url.searchParams.get("roomCode") || "";
    const roomCode = roomCodeRaw.trim().toUpperCase();
    const displayName = (url.searchParams.get("displayName") || "").trim();
    const userId = (url.searchParams.get("userId") || "").trim();
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    const room = await env.DB.prepare("SELECT code, created_at, is_locked, invite_only, created_by, max_members FROM rooms WHERE code = ?").bind(roomCode).first();
    if (!room) return json({ error: "Room not found" }, 404);
    if (displayName && userId) {
      const nameNorm = norm(displayName);
      const taken = await env.DB.prepare(`
          SELECT user_id FROM players
          WHERE room_code = ? AND name_norm = ?
          LIMIT 1
        `).bind(roomCode, nameNorm).first();
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
}, "onRequestGet");
var onRequestPost4 = /* @__PURE__ */ __name2(async ({ request, env }) => {
  try {
    await ensureSchema(env);
    const body = await request.json().catch(() => ({}));
    const roomCodeRaw = body?.roomCode || "";
    const roomCode = roomCodeRaw.trim().toUpperCase();
    const displayName = (body?.displayName || "").trim();
    const userId = (body?.userId || "").trim();
    const providedInviteCode = (body?.inviteCode || "").trim().toUpperCase();
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (roomCode.length < 3) {
      return json({
        error: "Room code must be at least 3 characters long",
        error_code: "ROOM_CODE_TOO_SHORT"
      }, 400);
    }
    if (roomCode.length > 12) {
      return json({
        error: "Room code must be 12 characters or less",
        error_code: "ROOM_CODE_TOO_LONG"
      }, 400);
    }
    const reservedCodes = ["ADMIN", "API", "TEST", "DEBUG", "NULL", "UNDEFINED", "ERROR"];
    if (reservedCodes.includes(roomCode)) {
      return json({
        error: "This room code is reserved. Please choose a different one.",
        error_code: "ROOM_CODE_RESERVED"
      }, 400);
    }
    const existingRoom = await env.DB.prepare(
      "SELECT code, invite_code FROM rooms WHERE code = ?"
    ).bind(roomCode).first();
    const inviteCode = existingRoom?.invite_code || generateInviteCode();
    await upsertWithRetry(
      env,
      "INSERT OR IGNORE INTO rooms (code, created_by, invite_code) VALUES (?, ?, ?)",
      [roomCode, userId || "anonymous", inviteCode]
    );
    await logEvent(env, "room_accessed", {
      roomCode,
      userId: userId || "anonymous",
      action: "create_or_access"
    });
    const roomStatus = await env.DB.prepare("SELECT code, created_at, is_locked, invite_only, created_by, max_members FROM rooms WHERE code = ?").bind(roomCode).first();
    if (displayName) {
      if (!userId) return json({ error: "userId required when displayName is provided" }, 400);
      if (roomStatus?.invite_only && roomStatus.created_by !== userId) {
        const roomWithInvite = await env.DB.prepare("SELECT invite_code FROM rooms WHERE code = ?").bind(roomCode).first();
        if (!providedInviteCode || providedInviteCode !== roomWithInvite?.invite_code) {
          return json({
            error: "This room is invite-only. Please provide a valid invite code to join.",
            error_code: "ROOM_INVITE_ONLY"
          }, 403);
        }
      }
      const currentMemberCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM players WHERE room_code = ?
      `).bind(roomCode).first();
      const maxMembers = roomStatus?.max_members || 50;
      if (currentMemberCount?.count >= maxMembers) {
        return json({
          error: `Room is full (${maxMembers} members maximum)`,
          error_code: "ROOM_FULL"
        }, 403);
      }
      const nameNorm = norm(displayName);
      const existingByName = await env.DB.prepare(`
          SELECT user_id FROM players
          WHERE room_code = ? AND name_norm = ?
          LIMIT 1
        `).bind(roomCode, nameNorm).first();
      if (existingByName && existingByName.user_id !== userId) {
        return json({
          error: `The name "${displayName}" is already taken in this room. Please choose a different name.`,
          error_code: "DUPLICATE_NAME"
        }, 409);
      }
      const membershipResult = await upsertWithRetry(env, `
        INSERT INTO players (room_code, user_id, name, name_norm)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(room_code, user_id) DO UPDATE SET
          name = excluded.name,
          name_norm = excluded.name_norm,
          last_seen_at = CURRENT_TIMESTAMP
      `, [roomCode, userId, displayName, nameNorm]);
      await logEvent(env, "user_joined_room", {
        roomCode,
        userId,
        displayName,
        isNewMember: membershipResult.changes > 0
      });
    }
    const room = await env.DB.prepare("SELECT code, created_at, is_locked, invite_only, created_by, max_members FROM rooms WHERE code = ?").bind(roomCode).first();
    return json({ ok: true, room });
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes("u_players_room_name_norm")) {
      return json({
        error: "Display name already taken in this room.",
        error_code: "DUPLICATE_NAME"
      }, 409);
    }
    return json({ error: msg }, 500);
  }
}, "onRequestPost");
var up3 = /* @__PURE__ */ __name2((s) => (s || "").trim().toUpperCase(), "up");
async function ensurePlayersShape2(env) {
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
}
__name(ensurePlayersShape2, "ensurePlayersShape2");
__name2(ensurePlayersShape2, "ensurePlayersShape");
async function getUserRoomStats(env, roomCode, userId) {
  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as entryCount,
      COALESCE(SUM(delta), 0) as totalDelta,
      MIN(created_at) as firstEntry,
      MAX(created_at) as lastEntry
    FROM entries 
    WHERE room_code = ? AND player_uuid = ?
  `).bind(roomCode, userId).first();
  const focusCount = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM weekly_focus
    WHERE room_code = ? AND player_uuid = ?
  `).bind(roomCode, userId).first();
  return {
    entryCount: stats?.entryCount || 0,
    totalDelta: stats?.totalDelta || 0,
    firstEntry: stats?.firstEntry,
    lastEntry: stats?.lastEntry,
    focusWeeksCount: focusCount?.count || 0
  };
}
__name(getUserRoomStats, "getUserRoomStats");
__name2(getUserRoomStats, "getUserRoomStats");
async function onRequestGet5({ request, env }) {
  try {
    await ensurePlayersShape2(env);
    const url = new URL(request.url);
    const roomCode = up3(url.searchParams.get("roomCode") || "");
    const userId = (url.searchParams.get("userId") || "").trim();
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId) return json({ error: "userId required" }, 400);
    const member = await env.DB.prepare(`
      SELECT name, created_at, last_seen_at
      FROM players 
      WHERE room_code = ? AND user_id = ?
    `).bind(roomCode, userId).first();
    if (!member) {
      return json({
        error: "You are not a member of this room",
        error_code: "NOT_A_MEMBER"
      }, 404);
    }
    const stats = await getUserRoomStats(env, roomCode, userId);
    const joinedDate = new Date(member.created_at);
    const daysSinceJoined = Math.ceil((Date.now() - joinedDate.getTime()) / (1e3 * 60 * 60 * 24));
    return json({
      ok: true,
      roomCode,
      userId,
      memberInfo: {
        name: member.name,
        joinedDate: member.created_at,
        lastSeen: member.last_seen_at,
        daysSinceJoined
      },
      activityStats: stats,
      confirmationMessage: generateLeaveMessage(member.name, stats, daysSinceJoined)
    });
  } catch (error) {
    console.error("Leave room info error:", error);
    return json({ error: error.message || "Failed to get leave info" }, 500);
  }
}
__name(onRequestGet5, "onRequestGet5");
__name2(onRequestGet5, "onRequestGet");
async function onRequestPost5({ request, env }) {
  try {
    await ensurePlayersShape2(env);
    const body = await request.json().catch(() => ({}));
    const roomCode = up3(body.roomCode || "");
    const userId = (body.userId || "").trim();
    const confirmed = body.confirmed === true;
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId) return json({ error: "userId required" }, 400);
    if (!confirmed) return json({
      error: "You must confirm leaving the room",
      error_code: "CONFIRMATION_REQUIRED"
    }, 400);
    const member = await env.DB.prepare(`
      SELECT name, created_at
      FROM players 
      WHERE room_code = ? AND user_id = ?
    `).bind(roomCode, userId).first();
    if (!member) {
      return json({
        error: "You are not a member of this room",
        error_code: "NOT_A_MEMBER"
      }, 404);
    }
    const stats = await getUserRoomStats(env, roomCode, userId);
    await upsertWithRetry(env, `
      DELETE FROM players WHERE room_code = ? AND user_id = ?
    `, [roomCode, userId]);
    await logEvent(env, "user_left_room", {
      roomCode,
      userId,
      playerName: member.name,
      memberSince: member.created_at,
      finalStats: stats
    });
    return json({
      ok: true,
      message: `Successfully left room ${roomCode}`,
      roomCode,
      userId
    });
  } catch (error) {
    console.error("Leave room error:", error);
    return json({ error: error.message || "Failed to leave room" }, 500);
  }
}
__name(onRequestPost5, "onRequestPost5");
__name2(onRequestPost5, "onRequestPost");
function generateLeaveMessage(playerName, stats, daysSinceJoined) {
  const messages = [
    `${playerName}, you've been part of this room for ${daysSinceJoined} days.`
  ];
  if (stats.entryCount > 0) {
    messages.push(`You've made ${stats.entryCount} entries with a total delta of ${stats.totalDelta}.`);
  }
  if (stats.focusWeeksCount > 0) {
    messages.push(`You've set your focus for ${stats.focusWeeksCount} weeks.`);
  }
  messages.push("Are you sure you want to leave? This action cannot be undone.");
  return messages.join(" ");
}
__name(generateLeaveMessage, "generateLeaveMessage");
__name2(generateLeaveMessage, "generateLeaveMessage");
var up4 = /* @__PURE__ */ __name2((s) => (s || "").trim().toUpperCase(), "up");
async function ensureSchema2(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_locked INTEGER DEFAULT 0,
      invite_only INTEGER DEFAULT 0,
      created_by TEXT,
      max_members INTEGER DEFAULT 50
    )
  `).run();
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
}
__name(ensureSchema2, "ensureSchema2");
__name2(ensureSchema2, "ensureSchema");
async function onRequestGet6({ request, env }) {
  try {
    await ensureSchema2(env);
    const url = new URL(request.url);
    const roomCode = up4(url.searchParams.get("roomCode") || "");
    const userId = (url.searchParams.get("userId") || "").trim();
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId) return json({ error: "userId required" }, 400);
    const room = await env.DB.prepare(`
      SELECT code, created_at, invite_only, created_by, max_members, invite_code
      FROM rooms WHERE code = ?
    `).bind(roomCode).first();
    if (!room) {
      return json({ error: "Room not found" }, 404);
    }
    const membership = await env.DB.prepare(`
      SELECT user_id FROM players WHERE room_code = ? AND user_id = ?
    `).bind(roomCode, userId).first();
    if (!membership) {
      return json({
        error: "You must be a member of this room to manage settings",
        error_code: "NOT_MEMBER"
      }, 403);
    }
    const members = await env.DB.prepare(`
      SELECT user_id, name, created_at, last_seen_at
      FROM players 
      WHERE room_code = ?
      ORDER BY created_at ASC
    `).bind(roomCode).all();
    return json({
      ok: true,
      room: {
        code: room.code,
        createdAt: room.created_at,
        inviteOnly: !!room.invite_only,
        createdBy: room.created_by,
        maxMembers: room.max_members,
        inviteCode: room.invite_code
      },
      members: (members.results || []).map((m) => ({
        userId: m.user_id,
        name: m.name,
        joinedAt: m.created_at,
        lastSeen: m.last_seen_at
      })),
      memberCount: members.results?.length || 0,
      isCreator: true
      // MVP: Everyone can manage for launch
    });
  } catch (error) {
    console.error("Room manage info error:", error);
    return json({ error: error.message || "Failed to get room info" }, 500);
  }
}
__name(onRequestGet6, "onRequestGet6");
__name2(onRequestGet6, "onRequestGet");
async function onRequestPost6({ request, env }) {
  try {
    await ensureSchema2(env);
    const body = await request.json().catch(() => ({}));
    const roomCode = up4(body.roomCode || "");
    const userId = (body.userId || "").trim();
    const { inviteOnly, maxMembers } = body;
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId) return json({ error: "userId required" }, 400);
    const room = await env.DB.prepare(`
      SELECT created_by FROM rooms WHERE code = ?
    `).bind(roomCode).first();
    if (!room) {
      return json({ error: "Room not found" }, 404);
    }
    const membership = await env.DB.prepare(`
      SELECT user_id FROM players WHERE room_code = ? AND user_id = ?
    `).bind(roomCode, userId).first();
    if (!membership) {
      return json({
        error: "You must be a member of this room to manage settings",
        error_code: "NOT_MEMBER"
      }, 403);
    }
    const updates = [];
    const values = [];
    if (typeof inviteOnly === "boolean") {
      updates.push("invite_only = ?");
      values.push(inviteOnly ? 1 : 0);
    }
    if (typeof maxMembers === "number" && maxMembers > 0 && maxMembers <= 200) {
      updates.push("max_members = ?");
      values.push(maxMembers);
    }
    if (updates.length === 0) {
      return json({ error: "No valid settings provided" }, 400);
    }
    values.push(roomCode);
    await upsertWithRetry(env, `
      UPDATE rooms SET ${updates.join(", ")} WHERE code = ?
    `, values);
    await logEvent(env, "room_settings_changed", {
      roomCode,
      userId,
      changes: { inviteOnly, maxMembers }
    });
    const updatedRoom = await env.DB.prepare(`
      SELECT code, created_at, invite_only, created_by, max_members
      FROM rooms WHERE code = ?
    `).bind(roomCode).first();
    return json({
      ok: true,
      room: {
        code: updatedRoom.code,
        createdAt: updatedRoom.created_at,
        inviteOnly: !!updatedRoom.invite_only,
        createdBy: updatedRoom.created_by,
        maxMembers: updatedRoom.max_members
      }
    });
  } catch (error) {
    console.error("Room manage error:", error);
    return json({ error: error.message || "Failed to update room settings" }, 500);
  }
}
__name(onRequestPost6, "onRequestPost6");
__name2(onRequestPost6, "onRequestPost");
var up5 = /* @__PURE__ */ __name2((s) => (s || "").trim().toUpperCase(), "up");
function generateRoomSuggestions(baseName = "", count = 5) {
  const suggestions = [];
  const base = baseName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8) || "ROOM";
  const patterns = [
    // Based on base name
    () => base + Math.floor(Math.random() * 1e3).toString().padStart(3, "0"),
    () => base.substring(0, 4) + Math.floor(Math.random() * 1e4).toString().padStart(4, "0"),
    // Fun/memorable patterns
    () => generateWordCombination(),
    () => generateDateBased(),
    () => generateRandomCode(6)
  ];
  for (let i = 0; i < count && suggestions.length < count; i++) {
    const pattern = patterns[i % patterns.length];
    const suggestion = pattern();
    if (!suggestions.includes(suggestion) && suggestion.length >= 3 && suggestion.length <= 12) {
      suggestions.push(suggestion);
    }
  }
  return suggestions;
}
__name(generateRoomSuggestions, "generateRoomSuggestions");
__name2(generateRoomSuggestions, "generateRoomSuggestions");
function generateWordCombination() {
  const words1 = ["FOCUS", "STUDY", "WORK", "TEAM", "SQUAD", "GUILD", "CREW"];
  const words2 = ["ZONE", "HUB", "LAB", "ROOM", "BASE", "DEN", "CAVE"];
  const word1 = words1[Math.floor(Math.random() * words1.length)];
  const word2 = words2[Math.floor(Math.random() * words2.length)];
  const num = Math.floor(Math.random() * 100);
  return `${word1}${word2}${num}`;
}
__name(generateWordCombination, "generateWordCombination");
__name2(generateWordCombination, "generateWordCombination");
function generateDateBased() {
  const now = /* @__PURE__ */ new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hour = now.getHours().toString().padStart(2, "0");
  return `ROOM${month}${day}${hour}`;
}
__name(generateDateBased, "generateDateBased");
__name2(generateDateBased, "generateDateBased");
function generateRandomCode(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
__name(generateRandomCode, "generateRandomCode");
__name2(generateRandomCode, "generateRandomCode");
async function ensureRoomsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
__name(ensureRoomsTable, "ensureRoomsTable");
__name2(ensureRoomsTable, "ensureRoomsTable");
async function checkAvailability(env, roomCodes) {
  if (!roomCodes.length) return [];
  await ensureRoomsTable(env);
  const placeholders = roomCodes.map(() => "?").join(",");
  const query = `SELECT code FROM rooms WHERE code IN (${placeholders})`;
  const result = await env.DB.prepare(query).bind(...roomCodes).all();
  const taken = new Set((result.results || []).map((r) => r.code));
  return roomCodes.map((code) => ({
    code,
    available: !taken.has(code)
  }));
}
__name(checkAvailability, "checkAvailability");
__name2(checkAvailability, "checkAvailability");
async function onRequestGet7({ request, env }) {
  try {
    const url = new URL(request.url);
    const baseName = url.searchParams.get("baseName") || "";
    const count = Math.min(parseInt(url.searchParams.get("count")) || 5, 10);
    const suggestions = generateRoomSuggestions(baseName, count * 2);
    const availability = await checkAvailability(env, suggestions);
    const available = availability.filter((item) => item.available).slice(0, count);
    await logEvent(env, "room_suggestions_requested", {
      baseName,
      requestedCount: count,
      generatedCount: suggestions.length,
      availableCount: available.length
    });
    return json({
      ok: true,
      suggestions: available.map((item) => item.code),
      baseName,
      count: available.length
    });
  } catch (error) {
    console.error("Room suggestions error:", error);
    return json({ error: error.message || "Failed to generate room suggestions" }, 500);
  }
}
__name(onRequestGet7, "onRequestGet7");
__name2(onRequestGet7, "onRequestGet");
async function onRequestPost7({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { roomCodes = [] } = body;
    if (!Array.isArray(roomCodes) || roomCodes.length === 0) {
      return json({ error: "roomCodes array is required" }, 400);
    }
    if (roomCodes.length > 20) {
      return json({ error: "Maximum 20 room codes can be checked at once" }, 400);
    }
    const normalizedCodes = roomCodes.map((code) => up5(code)).filter((code) => {
      return code.length >= 3 && code.length <= 12 && /^[A-Z0-9]+$/.test(code);
    });
    const availability = await checkAvailability(env, normalizedCodes);
    await logEvent(env, "room_availability_checked", {
      requestedCount: roomCodes.length,
      validCount: normalizedCodes.length,
      availableCount: availability.filter((item) => item.available).length
    });
    return json({
      ok: true,
      results: availability
    });
  } catch (error) {
    console.error("Room availability check error:", error);
    return json({ error: error.message || "Failed to check room availability" }, 500);
  }
}
__name(onRequestPost7, "onRequestPost7");
__name2(onRequestPost7, "onRequestPost");
var up6 = /* @__PURE__ */ __name2((s) => (s || "").trim().toUpperCase(), "up");
async function getCols2(env, table) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const cols = {};
  for (const r of info.results || []) cols[r.name] = { notnull: !!r.notnull, pk: !!r.pk, type: r.type };
  return cols;
}
__name(getCols2, "getCols2");
__name2(getCols2, "getCols");
async function ensurePlayersShape3(env) {
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
__name(ensurePlayersShape3, "ensurePlayersShape3");
__name2(ensurePlayersShape3, "ensurePlayersShape");
async function ensureEntriesShape(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT
      -- columns added below if missing
    )
  `).run();
  const cols = await getCols2(env, "entries");
  const add = /* @__PURE__ */ __name2(async (name, ddl) => {
    if (!cols[name]) await env.DB.prepare(`ALTER TABLE entries ADD COLUMN ${name} ${ddl}`).run();
  }, "add");
  await add("room_code", "TEXT");
  await add("player_uuid", "TEXT");
  await add("player_name", "TEXT");
  await add("delta", "INTEGER DEFAULT 0");
  await add("label", "TEXT");
  await add("created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_entries_room ON entries(room_code)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_entries_room_playeruuid ON entries(room_code, player_uuid)`).run();
}
__name(ensureEntriesShape, "ensureEntriesShape");
__name2(ensureEntriesShape, "ensureEntriesShape");
async function requireMember2(env, roomCode, userId) {
  await ensurePlayersShape3(env);
  const m = await env.DB.prepare(`
    SELECT user_id, name
    FROM players
    WHERE room_code = ? AND user_id = ?
    LIMIT 1
  `).bind(roomCode, userId).first();
  return m || null;
}
__name(requireMember2, "requireMember2");
__name2(requireMember2, "requireMember");
var onRequestGet8 = /* @__PURE__ */ __name2(async ({ request, env }) => {
  try {
    const roomCode = up6(new URL(request.url).searchParams.get("roomCode"));
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    await ensureEntriesShape(env);
    const rows = await env.DB.prepare(`
        SELECT player_name AS player, delta, label, created_at
        FROM entries
        WHERE room_code = ?
        ORDER BY created_at ASC
      `).bind(roomCode).all();
    const history = (rows.results || []).map((r) => ({
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
}, "onRequestGet");
var onRequestPost8 = /* @__PURE__ */ __name2(async ({ request, env }) => {
  try {
    const { roomCode: rc, entry } = await request.json().catch(() => ({}));
    const roomCode = up6(rc);
    const userId = (entry?.userId || "").trim();
    if (!roomCode || !entry || typeof entry.delta !== "number") {
      return json({ error: "roomCode and entry{delta} required" }, 400);
    }
    if (!userId) {
      return json({ error: "userId (UUID) required", error_code: "AUTH_REQUIRED" }, 401);
    }
    await ensureEntriesShape(env);
    const member = await requireMember2(env, roomCode, userId);
    if (!member) {
      return json({ error: "Join the room before posting entries.", error_code: "JOIN_REQUIRED" }, 403);
    }
    await upsertWithRetry(env, `
      INSERT INTO entries (room_code, player_uuid, player_name, delta, label, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [roomCode, userId, member.name, entry.delta, entry.label ?? null]);
    await logEvent(env, "entry_created", {
      roomCode,
      userId,
      delta: entry.delta,
      label: entry.label,
      playerName: member.name
    });
    await upsertWithRetry(env, `
      UPDATE players SET last_seen_at = CURRENT_TIMESTAMP
      WHERE room_code = ? AND user_id = ?
    `, [roomCode, userId]);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}, "onRequestPost");
var onRequestDelete = /* @__PURE__ */ __name2(async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const roomCode = up6(url.searchParams.get("roomCode"));
    const userId = (url.searchParams.get("userId") || "").trim();
    if (!roomCode) return json({ error: "roomCode required" }, 400);
    if (!userId) return json({ error: "userId (UUID) required", error_code: "AUTH_REQUIRED" }, 401);
    await ensureEntriesShape(env);
    const member = await requireMember2(env, roomCode, userId);
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
    const fifteenMs = 15 * 60 * 1e3;
    if (Date.now() - parsed > fifteenMs) {
      return json({ error: "Undo window elapsed (15 min)" }, 400);
    }
    await upsertWithRetry(env, `DELETE FROM entries WHERE id = ?`, [row.id]);
    await logEvent(env, "entry_deleted", {
      roomCode,
      userId,
      entryId: row.id,
      deletedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}, "onRequestDelete");
async function ensureUserTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
__name(ensureUserTable, "ensureUserTable");
__name2(ensureUserTable, "ensureUserTable");
async function onRequestPost9({ request, env }) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { userId, displayName, email } = payload;
    if (!userId || typeof userId !== "string") {
      return json({ error: "userId required" }, 400);
    }
    await ensureUserTable(env);
    const result = await upsertWithRetry(env, `
      INSERT INTO users (id, email, display_name, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        email = COALESCE(excluded.email, email),
        display_name = COALESCE(excluded.display_name, display_name),
        updated_at = datetime('now')
    `, [userId, email, displayName]);
    await logEvent(env, "user_upserted", {
      userId,
      email: email ? "[redacted]" : null,
      // Don't log actual email for privacy
      displayName,
      isNewUser: result.changes > 0
    });
    return json({
      userId,
      email,
      displayName,
      created: result.changes > 0
    }, result.changes > 0 ? 201 : 200);
  } catch (error) {
    console.error("User creation error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
}
__name(onRequestPost9, "onRequestPost9");
__name2(onRequestPost9, "onRequestPost");
async function onRequestGet9({ request, env }) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return json({ error: "userId required" }, 400);
    }
    await ensureUserTable(env);
    const user = await env.DB.prepare(
      "SELECT id, email, display_name, created_at FROM users WHERE id = ?"
    ).bind(userId).first();
    if (!user) {
      return json({ error: "User not found" }, 404);
    }
    return json({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error("User fetch error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
}
__name(onRequestGet9, "onRequestGet9");
__name2(onRequestGet9, "onRequestGet");
var routes = [
  {
    routePath: "/impulse-api/events",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/impulse-api/events",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/impulse-api/focus",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/impulse-api/focus",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/impulse-api/health",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/impulse-api/init-db",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/impulse-api/room",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/impulse-api/room",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/impulse-api/room-leave",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/impulse-api/room-leave",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/impulse-api/room-manage",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/impulse-api/room-manage",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/impulse-api/room-suggestions",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/impulse-api/room-suggestions",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/impulse-api/state",
    mountPath: "/impulse-api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/impulse-api/state",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/impulse-api/state",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/impulse-api/user",
    mountPath: "/impulse-api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/impulse-api/user",
    mountPath: "/impulse-api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-Y2Njdo/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-Y2Njdo/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.42732680892103736.js.map
