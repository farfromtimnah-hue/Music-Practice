-- One student can register passkeys on several devices; store the Stytch registration ids, comma-separated.
ALTER TABLE students RENAME COLUMN passkey_id TO passkey_ids;
