CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mode TEXT NOT NULL,
  rules_version INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  miss INTEGER,
  max_combo INTEGER,
  duration_ms INTEGER,
  date_key TEXT,
  passage_id TEXT,
  end_reason TEXT,
  end_ms INTEGER
);
CREATE INDEX IF NOT EXISTS results_kind_version ON results (kind, rules_version, mode);
CREATE INDEX IF NOT EXISTS results_endurance_day ON results (kind, date_key, mode);
