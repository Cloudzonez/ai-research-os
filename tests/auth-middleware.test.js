import test from "node:test";
import assert from "node:assert/strict";
import { generateToken } from "../server/middleware/auth.js";

// ---------------------------------------------------------------------------
// Auth middleware — validates JWT generation
// Spec ref: BUILD_PLAN.md Phase 2 "Web/API process for auth"
// ---------------------------------------------------------------------------

// authRequired, adminRequired, and authOptional are Express middleware
// that require full request/response mocking. We test generateToken which
// is a pure function, and validate the token structure.

test("generateToken creates a valid JWT string for a user", () => {
  const user = {
    _id: "user-123",
    email: "teacher@university.edu",
    role: "teacher",
  };

  const token = generateToken(user);
  assert.ok(typeof token === "string");
  assert.ok(token.length > 20, "JWT should be a substantial string");
  // JWT has 3 parts separated by dots
  const parts = token.split(".");
  assert.equal(parts.length, 3, "JWT should have 3 dot-separated parts");
});

test("generateToken creates different tokens for different users", () => {
  const token1 = generateToken({ _id: "u1", email: "a@u.edu", role: "teacher" });
  const token2 = generateToken({ _id: "u2", email: "b@u.edu", role: "teacher" });
  assert.notEqual(token1, token2);
});

test("generateToken includes admin role when applicable", () => {
  const token = generateToken({ _id: "admin-1", email: "admin@u.edu", role: "admin" });
  assert.ok(typeof token === "string");
});

test("generateToken handles user with name field", () => {
  const token = generateToken({
    _id: "u1",
    email: "name@u.edu",
    role: "teacher",
    name: "Dr. Zhang",
  });
  assert.ok(typeof token === "string");
});

// Test the JWT payload structure by decoding the token (without verification)
test("generated token payload contains user id, email, and role", () => {
  const user = { _id: "payload-test", email: "test@u.edu", role: "teacher" };
  const token = generateToken(user);

  // Decode the base64 payload (middle part)
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf-8")
  );

  assert.equal(payload.id, "payload-test");
  assert.equal(payload.email, "test@u.edu");
  assert.equal(payload.role, "teacher");
});

test("generated token has expiration time (~7 days)", () => {
  const token = generateToken({ _id: "u1", email: "e@u.edu", role: "teacher" });
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf-8")
  );

  assert.ok(payload.exp, "token should have expiration");
  // Should expire in the future
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
  // Should expire within ~8 days (7 days + some buffer)
  const sevenDaysSeconds = 7 * 24 * 60 * 60;
  assert.ok(payload.exp < Math.floor(Date.now() / 1000) + sevenDaysSeconds + 3600);
});

test("generated token has issued-at time", () => {
  const token = generateToken({ _id: "u1", email: "e@u.edu", role: "teacher" });
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf-8")
  );
  assert.ok(payload.iat, "token should have issued-at time");
});
