import { json, logEvent, upsertWithRetry } from "./_util.js";

const up = (s) => (s || "").trim().toUpperCase();

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
    console.error('Failed to ensure events table:', error);
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

// GET /impulse-api/events?roomCode=ABCDE&type=room_join&limit=100
export async function onRequestGet({ request, env }) {
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
    const events = (result.results || []).map(row => ({
      id: row.id,
      type: row.type,
      roomCode: row.room_code,
      userId: row.user_id,
      data: row.data ? JSON.parse(row.data) : {},
      createdAt: row.created_at
    }));
    
    return json({ ok: true, events, count: events.length });
  } catch (error) {
    console.error('Events fetch error:', error);
    return json({ error: error.message || 'Failed to fetch events' }, 500);
  }
}

// POST /impulse-api/events - Manual event logging (for testing/admin)
export async function onRequestPost({ request, env }) {
  try {
    await ensureEventsTable(env);
    
    const body = await request.json().catch(() => ({}));
    const { type, roomCode, userId, data = {} } = body;
    
    if (!type) {
      return json({ error: 'Event type is required' }, 400);
    }
    
    const event = await logEvent(env, type, {
      ...data,
      roomCode: roomCode ? up(roomCode) : undefined,
      userId
    });
    
    if (!event) {
      return json({ error: 'Failed to log event' }, 500);
    }
    
    return json({ ok: true, event }, 201);
  } catch (error) {
    console.error('Event creation error:', error);
    return json({ error: error.message || 'Failed to create event' }, 500);
  }
}