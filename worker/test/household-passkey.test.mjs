// Run: node worker/test/household-passkey.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptsPasskey } from "../src/household.js";

const U = "user-test-111";
const kid1 = { id: 1, stytch_user_id: U, passkey_ids: "reg-A" };
const kid2 = { id: 2, stytch_user_id: U, passkey_ids: "reg-B,reg-C" };
const auth = (user_id, reg) => ({ user_id, webauthn_registration_id: reg });
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok  " + name); };

t("(a) own passkey is accepted", () => assert.equal(acceptsPasskey(kid1, [kid2], auth(U, "reg-A")), true));
t("(b) sibling passkey with the same stytch_user_id is accepted", () => {
  assert.equal(acceptsPasskey(kid1, [kid2], auth(U, "reg-B")), true);
  assert.equal(acceptsPasskey(kid1, [kid2], auth(U, "reg-C")), true);
});
t("(c) passkey from a different stytch_user_id is rejected even if its id is listed", () =>
  assert.equal(acceptsPasskey(kid1, [kid2], auth("someone-else", "reg-B")), false));
t("(d) a registration id in no row is rejected", () => assert.equal(acceptsPasskey(kid1, [kid2], auth(U, "reg-ZZZ")), false));
t("(e) null, empty or missing stytch_user_id is rejected", () => {
  for (const uid of [null, "", undefined]) {
    assert.equal(acceptsPasskey({ id: 3, stytch_user_id: uid, passkey_ids: "reg-A" }, [kid2], auth(uid, "reg-A")), false);
    assert.equal(acceptsPasskey({ id: 3, stytch_user_id: uid, passkey_ids: "reg-A" }, [kid2], auth(U, "reg-A")), false);
  }
});
t("(f) index.js sibling query keeps role = 'student' and active = 1, and uses acceptsPasskey", () => {
  const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const q = src.match(/SELECT passkey_ids FROM students WHERE[^"]*"/);
  assert.ok(q, "sibling query not found");
  assert.ok(q[0].includes("role = 'student'"));
  assert.ok(q[0].includes("active = 1"));
  assert.ok(q[0].includes("stytch_user_id = ?") && q[0].includes("id != ?"));
  assert.ok(src.includes("acceptsPasskey(s, sib, r)"));
  assert.ok(src.includes('import { acceptsPasskey } from "./household.js"'));
});
t("(f2) the function only trusts rows it is given (a teacher row not passed in cannot help)", () => {
  const teacher = { id: 9, stytch_user_id: U, passkey_ids: "reg-T" };
  assert.equal(acceptsPasskey(kid1, [kid2], auth(U, "reg-T")), false);
  void teacher;
});
t("(g) empty passkey_ids on both rows is rejected", () => {
  const a = { id: 1, stytch_user_id: U, passkey_ids: "" }, b = { id: 2, stytch_user_id: U, passkey_ids: null };
  assert.equal(acceptsPasskey(a, [b], auth(U, "reg-A")), false);
  assert.equal(acceptsPasskey(a, [b], auth(U, "")), false);
  assert.equal(acceptsPasskey(a, [b], auth(U, undefined)), false);
});
console.log(`\n${n} tests passed`);
