import { json } from "./_util.js";

// Initialize database with all required tables
export async function onRequestPost({ request, env }) {
  try {
    console.log('Initializing database tables...');
    
    // Create events table
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
    
    // Create/update rooms table with all new columns
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
    
    // Add missing columns to existing rooms table
    const addColumn = async (column, definition) => {
      try {
        await env.DB.prepare(`ALTER TABLE rooms ADD COLUMN ${column} ${definition}`).run();
      } catch (e) {
        // Column already exists, ignore
      }
    };
    
    await addColumn('is_locked', 'INTEGER DEFAULT 0');
    await addColumn('invite_only', 'INTEGER DEFAULT 0'); 
    await addColumn('created_by', 'TEXT');
    await addColumn('max_members', 'INTEGER DEFAULT 50');
    await addColumn('invite_code', 'TEXT');
    
    // Create other tables
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
    
    // Create indexes
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_user ON players(room_code, user_id)`).run();
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_players_room_name_norm ON players(room_code, name_norm)`).run();
    await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS u_weekly_focus_room_uuid_week ON weekly_focus(room_code, player_uuid, week_key)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_events_room ON events(room_code)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_entries_room ON entries(room_code)`).run();
    
    console.log('Database initialization complete!');
    
    return json({ 
      ok: true, 
      message: 'Database initialized successfully',
      tables: ['events', 'rooms', 'players', 'users', 'entries', 'weekly_focus']
    });
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    return json({ error: error.message || 'Database initialization failed' }, 500);
  }
}