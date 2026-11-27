-- Optional email so workers can send themselves their weekly hours from the kiosk.
ALTER TABLE workers ADD COLUMN email TEXT;

-- Log of "send me my hours" emails (also used to cap sends per worker per day).
CREATE TABLE hours_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  week_start TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  detail TEXT
);
CREATE INDEX hours_emails_worker ON hours_emails(worker_id, sent_at);
