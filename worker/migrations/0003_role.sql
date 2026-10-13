-- The teacher/admin is a real account row (own phone, own passkey), not a student:
-- hidden from the sign-in roster, not removable from the Students screen.
ALTER TABLE students ADD COLUMN role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher'));
