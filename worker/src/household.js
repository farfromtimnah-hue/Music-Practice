// Household passkey rule. Kept in its own file so node can test it without the Worker runtime.

const idsOf = (row) => (row && row.passkey_ids ? String(row.passkey_ids).split(",").filter(Boolean) : []);

// student:     the row the child picked (needs stytch_user_id and passkey_ids)
// siblingRows: rows with role = 'student', active = 1, the same stytch_user_id, not the student itself.
//              The caller is responsible for that filter; teacher and removed rows must never be passed in.
// authResult:  the Stytch webauthn.authenticate result (user_id, webauthn_registration_id)
export function acceptsPasskey(student, siblingRows, authResult) {
  const uid = student && student.stytch_user_id;
  if (typeof uid !== "string" || uid === "") return false;
  if (!authResult || authResult.user_id !== uid) return false;
  const reg = authResult.webauthn_registration_id;
  if (typeof reg !== "string" || reg === "") return false;
  if (idsOf(student).includes(reg)) return true;
  return (siblingRows || []).some((row) => idsOf(row).includes(reg));
}
