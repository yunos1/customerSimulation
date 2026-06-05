CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  trust_level INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  meta_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS leaderboard (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  username TEXT NOT NULL,
  avatar_url TEXT,
  total_runs INTEGER DEFAULT 0,
  best_satisfaction REAL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
