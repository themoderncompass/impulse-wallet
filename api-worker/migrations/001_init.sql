-- D1 database schema for Impulse Wallet
-- Creates tables for rooms, players, entries, and locks.

CREATE TABLE IF NOT EXISTS rooms (
  room_id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  tz TEXT NOT NULL DEFAULT 'America/Chicago',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, display_name),
  FOREIGN KEY(room_id) REFERENCES rooms(room_id)
);

CREATE TABLE IF NOT EXISTS entries (
  entry_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount IN (-1, 0, 1)),
  impulse TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  undo_of TEXT,
  FOREIGN KEY(room_id) REFERENCES rooms(room_id),
  FOREIGN KEY(player_id) REFERENCES players(player_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_room_created ON entries(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_entries_player_created ON entries(player_id, created_at);

CREATE TABLE IF NOT EXISTS locks (
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  week_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('none','win','loss')),
  PRIMARY KEY(room_id, player_id, week_key),
  FOREIGN KEY(room_id) REFERENCES rooms(room_id),
  FOREIGN KEY(player_id) REFERENCES players(player_id)
);
