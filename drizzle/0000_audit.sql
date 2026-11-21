CREATE TABLE audit_records (
  id TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  decision TEXT NOT NULL,
  record_json TEXT NOT NULL
);
