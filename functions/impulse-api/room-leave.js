import { json, upsertWithRetry, logEvent } from "./_util.js";

const up = (s) => (s || "").trim().toUpperCase();

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
}

async function getUserRoomStats(env, roomCode, userId) {
  // Get user's activity stats in this room
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

// GET /impulse-api/room-leave?roomCode=ABCDE&userId=uuid - Get leave confirmation info
export async function onRequestGet({ request, env }) {
  try {
    await ensurePlayersShape(env);
    
    const url = new URL(request.url);
    const roomCode = up(url.searchParams.get('roomCode') || '');
    const userId = (url.searchParams.get('userId') || '').trim();
    
    if (!roomCode) return json({ error: 'roomCode required' }, 400);
    if (!userId) return json({ error: 'userId required' }, 400);
    
    // Check if user is actually in the room
    const member = await env.DB.prepare(`
      SELECT name, created_at, last_seen_at
      FROM players 
      WHERE room_code = ? AND user_id = ?
    `).bind(roomCode, userId).first();
    
    if (!member) {
      return json({ 
        error: 'You are not a member of this room',
        error_code: 'NOT_A_MEMBER'
      }, 404);
    }
    
    // Get user's activity stats for confirmation message
    const stats = await getUserRoomStats(env, roomCode, userId);
    
    // Calculate days since joining
    const joinedDate = new Date(member.created_at);
    const daysSinceJoined = Math.ceil((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));
    
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
    console.error('Leave room info error:', error);
    return json({ error: error.message || 'Failed to get leave info' }, 500);
  }
}

// POST /impulse-api/room-leave - Actually leave the room
export async function onRequestPost({ request, env }) {
  try {
    await ensurePlayersShape(env);
    
    const body = await request.json().catch(() => ({}));
    const roomCode = up(body.roomCode || '');
    const userId = (body.userId || '').trim();
    const confirmed = body.confirmed === true;
    
    if (!roomCode) return json({ error: 'roomCode required' }, 400);
    if (!userId) return json({ error: 'userId required' }, 400);
    if (!confirmed) return json({ 
      error: 'You must confirm leaving the room',
      error_code: 'CONFIRMATION_REQUIRED'
    }, 400);
    
    // Check if user is actually in the room
    const member = await env.DB.prepare(`
      SELECT name, created_at
      FROM players 
      WHERE room_code = ? AND user_id = ?
    `).bind(roomCode, userId).first();
    
    if (!member) {
      return json({ 
        error: 'You are not a member of this room',
        error_code: 'NOT_A_MEMBER'
      }, 404);
    }
    
    // Get stats before leaving (for logging)
    const stats = await getUserRoomStats(env, roomCode, userId);
    
    // Remove from players table
    await upsertWithRetry(env, `
      DELETE FROM players WHERE room_code = ? AND user_id = ?
    `, [roomCode, userId]);
    
    // Log the leave event with stats
    await logEvent(env, 'user_left_room', {
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
    console.error('Leave room error:', error);
    return json({ error: error.message || 'Failed to leave room' }, 500);
  }
}

function generateLeaveMessage(playerName, stats, daysSinceJoined) {
  const messages = [
    `${playerName}, you've been part of this room for ${daysSinceJoined} days.`,
  ];
  
  if (stats.entryCount > 0) {
    messages.push(`You've made ${stats.entryCount} entries with a total delta of ${stats.totalDelta}.`);
  }
  
  if (stats.focusWeeksCount > 0) {
    messages.push(`You've set your focus for ${stats.focusWeeksCount} weeks.`);
  }
  
  messages.push('Are you sure you want to leave? This action cannot be undone.');
  
  return messages.join(' ');
}