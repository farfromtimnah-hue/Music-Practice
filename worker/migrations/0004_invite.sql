-- Invite links: a random 32-hex token resolves to exactly ONE row's own enrollment.
ALTER TABLE students ADD COLUMN invite_token TEXT;
ALTER TABLE students ADD COLUMN invite_expires_at TEXT;
CREATE UNIQUE INDEX students_invite_token ON students (invite_token) WHERE invite_token IS NOT NULL;
