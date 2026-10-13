CREATE TABLE students (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  instrument     TEXT NOT NULL CHECK (instrument IN ('guitar','bass','keys')),
  phone          TEXT NOT NULL,
  stytch_user_id TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  active         INTEGER NOT NULL DEFAULT 1,
  -- enrollment state (not part of the roster spec; needed to bind a passkey to ONE student
  -- even when siblings share a parent phone / Stytch user)
  otp_method_id  TEXT,
  otp_sent_at    TEXT,
  verified_at    TEXT,
  passkey_id     TEXT
);
-- A name is the localStorage key for history, so two ACTIVE students may not share one.
-- Removed rows keep their name and are exempt.
CREATE UNIQUE INDEX students_active_name ON students (name) WHERE active = 1;
