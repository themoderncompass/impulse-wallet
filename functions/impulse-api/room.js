// functions/impulse-api/room.js
import { json, upsertWithRetry, logEvent } from "./_util.js";

// small helper: normalize names for case-insensitive dedupe
const norm = (s) => (s || "").trim().toLowerCase();

// Generate a random invite code (8 characters, alphanumeric)
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Ensure/upgrade schema (idempotent). Call at the start of GET/POST.
async function ensureSchema(env) {
  // rooms table (codes stored UPPERCASE by us)
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
  
  // Add new columns if they don't exist (for existing tables)
  const addColumnIfNotExists = async (column, definition) => {
    try {
      await env.DB.prepare(`ALTER TABLE rooms ADD COLUMN ${column} ${definition}`).run();
    } catch (e) {
      // Column likely already exists, ignore error
    }
  };
  
  await addColumnIfNotExists('is_locked', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('invite_only', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('created_by', 'TEXT');
  await addColumnIfNotExists('max_members', 'INTEGER DEFAULT 50');
  await addColumnIfNotExists('invite_code', 'TEXT');

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
      .prepare("SELECT code, created_at, is_locked, invite_only, created_by, max_members FROM rooms WHERE code = ?")
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
    const providedInviteCode = (body?.inviteCode || "").trim().toUpperCase();

    if (!roomCode) return json({ error: "roomCode required" }, 400);
    
    // Enhanced room code validation and collision prevention
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
    
    // Check for inappropriate/reserved room codes
    const reservedCodes = ['ADMIN', 'API', 'TEST', 'DEBUG', 'NULL', 'UNDEFINED', 'ERROR'];
    if (reservedCodes.includes(roomCode)) {
      return json({ 
        error: "This room code is reserved. Please choose a different one.",
        error_code: "ROOM_CODE_RESERVED" 
      }, 400);
    }

    // Check if room already exists to determine if we need to generate invite code
    const existingRoom = await env.DB.prepare(
      "SELECT code, invite_code FROM rooms WHERE code = ?"
    ).bind(roomCode).first();
    
    // Generate invite code for new rooms
    const inviteCode = existingRoom?.invite_code || generateInviteCode();
    
    // Upsert room with retry logic - set creator and invite code if it's a new room
    await upsertWithRetry(env,
      "INSERT OR IGNORE INTO rooms (code, created_by, invite_code) VALUES (?, ?, ?)",
      [roomCode, userId || 'anonymous', inviteCode]
    );
    
    // Log room creation/access event
    await logEvent(env, 'room_accessed', {
      roomCode,
      userId: userId || 'anonymous',
      action: 'create_or_access'
    });

    // Check room status after ensuring it exists
    const roomStatus = await env.DB
      .prepare("SELECT code, created_at, is_locked, invite_only, created_by, max_members FROM rooms WHERE code = ?")
      .bind(roomCode)
      .first();

    // If the client provided a name, claim/update membership for this UUID
    if (displayName) {
      if (!userId) return json({ error: "userId required when displayName is provided" }, 400);
      
      // Check if room is invite-only (creators can always join)
      if (roomStatus?.invite_only && roomStatus.created_by !== userId) {
        // Get the room's invite code for validation
        const roomWithInvite = await env.DB
          .prepare("SELECT invite_code FROM rooms WHERE code = ?")
          .bind(roomCode)
          .first();
        
        // If no invite code provided or doesn't match, deny access
        if (!providedInviteCode || providedInviteCode !== roomWithInvite?.invite_code) {
          return json({
            error: "This room is invite-only. Please provide a valid invite code to join.",
            error_code: "ROOM_INVITE_ONLY"
          }, 403);
        }
      }
      
      // Check member count limit
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

      // Idempotent membership UPSERT with retry logic
      const membershipResult = await upsertWithRetry(env, `
        INSERT INTO players (room_code, user_id, name, name_norm)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(room_code, user_id) DO UPDATE SET
          name = excluded.name,
          name_norm = excluded.name_norm,
          last_seen_at = CURRENT_TIMESTAMP
      `, [roomCode, userId, displayName, nameNorm]);
      
      // Log membership event
      await logEvent(env, 'user_joined_room', {
        roomCode,
        userId,
        displayName,
        isNewMember: membershipResult.changes > 0
      });
    }

    const room = await env.DB
      .prepare("SELECT code, created_at, is_locked, invite_only, created_by, max_members FROM rooms WHERE code = ?")
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
