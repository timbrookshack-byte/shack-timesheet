-- Personal access codes for owners / managers (Tim, Shaun, …).
-- Alex's original MANAGER_CODE secret keeps working alongside these.
-- code_hash = HMAC-SHA256(SESSION_SECRET, code): a database copy alone can't reveal a code.
CREATE TABLE managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',   -- owner (can manage access) | manager
  code_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

-- Who made each override / edit (the name at the time).
ALTER TABLE adjustments ADD COLUMN changed_by TEXT;
