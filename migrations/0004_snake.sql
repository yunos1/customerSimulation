-- 贪吃蛇排行榜（历史最高分）
CREATE TABLE IF NOT EXISTS snake_scores (
  user_id    TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  avatar_url TEXT,
  score      INTEGER NOT NULL DEFAULT 0,
  kills      INTEGER NOT NULL DEFAULT 0,
  skin_id    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 单局记录
CREATE TABLE IF NOT EXISTS snake_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  score      INTEGER NOT NULL,
  kills      INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL,
  played_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snake_sessions_user ON snake_sessions(user_id);
