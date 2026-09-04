import test from "node:test";
import assert from "node:assert/strict";
import { canUseChat, registerMessageId } from "../src/lib/chat";

test("registerMessageId accepts a new message exactly once", () => {
  const seenIds = new Set<string>();

  assert.equal(registerMessageId(seenIds, "message-1"), true);
  assert.equal(registerMessageId(seenIds, "message-1"), false);
  assert.deepEqual([...seenIds], ["message-1"]);
});

test("registering one message does not suppress another", () => {
  const seenIds = new Set<string>();

  assert.equal(registerMessageId(seenIds, "message-1"), true);
  assert.equal(registerMessageId(seenIds, "message-2"), true);
});

test("chat stays disabled for one participant and enables for two", () => {
  assert.equal(canUseChat(0), false);
  assert.equal(canUseChat(1), false);
  assert.equal(canUseChat(2), true);
  assert.equal(canUseChat(10), true);
});
