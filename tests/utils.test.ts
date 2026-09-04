import test from "node:test";
import assert from "node:assert/strict";
import { createId, generateRoomCode, normalizeRoomCode } from "../src/lib/utils";

test("generateRoomCode creates an unambiguous six-character code", () => {
  const code = generateRoomCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
});

test("normalizeRoomCode trims and uppercases valid codes", () => {
  assert.equal(normalizeRoomCode("  a4b9xz "), "A4B9XZ");
});

test("normalizeRoomCode rejects ambiguous or malformed codes", () => {
  assert.equal(normalizeRoomCode("ROOM01"), null);
  assert.equal(normalizeRoomCode("../A4B9XZ"), null);
  assert.equal(normalizeRoomCode("ABC"), null);
});

test("createId returns distinct identifiers without requiring randomUUID", () => {
  const ids = new Set(Array.from({ length: 100 }, () => createId()));
  assert.equal(ids.size, 100);
});
