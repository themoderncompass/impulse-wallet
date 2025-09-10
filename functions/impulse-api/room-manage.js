import { json, upsertWithRetry, logEvent } from "./_util.js";

const up = (s) => (s || "").trim().toUpperCase();

async function ensureSchema(env) {
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

async function isRoomCreator(env, roomCode, userId) {
  const room = await env.DB.prepare(`
    SELECT created_by FROM rooms WHERE code = ?
  `).bind(roomCode).first();
  
  return room?.created_by === userId;
}

// GET /impulse-api/room-manage?roomCode=ABCDE&userId=uuid - Get room management info
export async function onRequestGet({ request, env }) {
  try {
    await ensureSchema(env);
    
    const url = new URL(request.url);
    const roomCode = up(url.searchParams.get('roomCode') || '');
    const userId = (url.searchParams.get('userId') || '').trim();
    
    if (!roomCode) return json({ error: 'roomCode required' }, 400);
    if (!userId) return json({ error: 'userId required' }, 400);
    
    const room = await env.DB.prepare(`
      SELECT code, created_at, is_locked, invite_only, created_by, max_members, invite_code
      FROM rooms WHERE code = ?
    `).bind(roomCode).first();
    
    if (!room) {
      return json({ error: 'Room not found' }, 404);
    }
    
    const isCreator = room.created_by === userId;
    
    if (!isCreator) {
      return json({ 
        error: 'Only the room creator can manage room settings',
        error_code: 'NOT_CREATOR'
      }, 403);
    }
    
    // Get member count and list
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
        isLocked: !!room.is_locked,
        inviteOnly: !!room.invite_only,
        createdBy: room.created_by,
        maxMembers: room.max_members,
        inviteCode: room.invite_code
      },
      members: (members.results || []).map(m => ({
        userId: m.user_id,
        name: m.name,
        joinedAt: m.created_at,
        lastSeen: m.last_seen_at
      })),
      memberCount: members.results?.length || 0,
      isCreator
    });
    
  } catch (error) {
    console.error('Room manage info error:', error);
    return json({ error: error.message || 'Failed to get room info' }, 500);
  }
}

// POST /impulse-api/room-manage - Update room settings
export async function onRequestPost({ request, env }) {
  try {
    await ensureSchema(env);
    
    const body = await request.json().catch(() => ({}));
    const roomCode = up(body.roomCode || '');
    const userId = (body.userId || '').trim();
    const { isLocked, inviteOnly, maxMembers } = body;
    
    if (!roomCode) return json({ error: 'roomCode required' }, 400);
    if (!userId) return json({ error: 'userId required' }, 400);
    
    const room = await env.DB.prepare(`
      SELECT created_by FROM rooms WHERE code = ?
    `).bind(roomCode).first();
    
    if (!room) {
      return json({ error: 'Room not found' }, 404);
    }
    
    if (room.created_by !== userId) {
      return json({ 
        error: 'Only the room creator can manage room settings',
        error_code: 'NOT_CREATOR'
      }, 403);
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    
    if (typeof isLocked === 'boolean') {
      updates.push('is_locked = ?');
      values.push(isLocked ? 1 : 0);
    }
    
    if (typeof inviteOnly === 'boolean') {
      updates.push('invite_only = ?');
      values.push(inviteOnly ? 1 : 0);
    }
    
    if (typeof maxMembers === 'number' && maxMembers > 0 && maxMembers <= 200) {
      updates.push('max_members = ?');
      values.push(maxMembers);
    }
    
    if (updates.length === 0) {
      return json({ error: 'No valid settings provided' }, 400);
    }
    
    values.push(roomCode); // for WHERE clause
    
    await upsertWithRetry(env, `
      UPDATE rooms SET ${updates.join(', ')} WHERE code = ?
    `, values);
    
    // Log room settings change
    await logEvent(env, 'room_settings_changed', {
      roomCode,
      userId,
      changes: { isLocked, inviteOnly, maxMembers }
    });
    
    // Get updated room info
    const updatedRoom = await env.DB.prepare(`
      SELECT code, created_at, is_locked, invite_only, created_by, max_members
      FROM rooms WHERE code = ?
    `).bind(roomCode).first();
    
    return json({
      ok: true,
      room: {
        code: updatedRoom.code,
        createdAt: updatedRoom.created_at,
        isLocked: !!updatedRoom.is_locked,
        inviteOnly: !!updatedRoom.invite_only,
        createdBy: updatedRoom.created_by,
        maxMembers: updatedRoom.max_members
      }
    });
    
  } catch (error) {
    console.error('Room manage error:', error);
    return json({ error: error.message || 'Failed to update room settings' }, 500);
  }
}