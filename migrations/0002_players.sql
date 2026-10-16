CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS results_player ON results (kind, mode, rules_version, player_id);
