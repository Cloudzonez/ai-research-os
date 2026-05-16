import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { put, get, getUrl, remove, getPath } from "../server/services/storage.js";

// ---------------------------------------------------------------------------
// storage — validates filesystem storage operations
// Spec ref: BUILD_PLAN.md Phase 2 "Add object storage"
// ---------------------------------------------------------------------------

// storage.js uses config.storagePath which is set during import.
// We test with the real config path; tests use unique filenames to avoid collision.
const TEST_PREFIX = `test-${Date.now()}-`;

test("put writes buffer to filesystem and returns path", async () => {
  const filename = `${TEST_PREFIX}put-test.txt`;
  const buffer = Buffer.from("hello storage");
  const filePath = await put(filename, buffer);

  assert.ok(filePath.includes(filename));
  assert.ok(fs.existsSync(filePath));

  // Cleanup
  await remove(filename);
});

test("get returns buffer for existing file", async () => {
  const filename = `${TEST_PREFIX}get-test.txt`;
  await put(filename, Buffer.from("test content"));

  const buffer = await get(filename);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.toString(), "test content");

  await remove(filename);
});

test("get returns null for missing file", async () => {
  const result = await get(`${TEST_PREFIX}nonexistent-file.txt`);
  assert.equal(result, null);
});

test("remove deletes existing file and returns true", async () => {
  const filename = `${TEST_PREFIX}remove-test.txt`;
  await put(filename, Buffer.from("to be deleted"));

  const result = await remove(filename);
  assert.equal(result, true);
  assert.ok(!fs.existsSync(getPath(filename)));
});

test("remove returns false for missing file", async () => {
  const result = await remove(`${TEST_PREFIX}nonexistent-remove.txt`);
  assert.equal(result, false);
});

test("getUrl returns /uploads/ prefixed path", () => {
  const url = getUrl("paper-123.pdf");
  assert.equal(url, "/uploads/paper-123.pdf");
});

test("getUrl works with nested-looking filenames", () => {
  const url = getUrl("subdir/file.pdf");
  assert.equal(url, "/uploads/subdir/file.pdf");
});

test("getPath returns absolute path", () => {
  const filePath = getPath("test.pdf");
  assert.ok(path.isAbsolute(filePath));
  assert.ok(filePath.endsWith("test.pdf"));
});

test("put creates storage directory if it does not exist", async () => {
  const filename = `${TEST_PREFIX}mkdir-test.txt`;
  await put(filename, Buffer.from("test"));
  const filePath = getPath(filename);
  assert.ok(fs.existsSync(filePath));
  await remove(filename);
});

test("put and get round-trip preserves binary data", async () => {
  const filename = `${TEST_PREFIX}binary-test.bin`;
  const original = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
  await put(filename, original);

  const retrieved = await get(filename);
  assert.deepEqual(retrieved, original);

  await remove(filename);
});

test("put overwrites existing file with same name", async () => {
  const filename = `${TEST_PREFIX}overwrite-test.txt`;
  await put(filename, Buffer.from("first write"));
  await put(filename, Buffer.from("second write"));

  const contents = await get(filename);
  assert.equal(contents.toString(), "second write");

  await remove(filename);
});
