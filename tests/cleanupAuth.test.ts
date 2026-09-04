import test from "node:test";
import assert from "node:assert/strict";
import { isCleanupRequestAuthorized } from "../src/lib/cleanupAuth";

const secret = "a-long-random-test-secret";

test("accepts Vercel Cron bearer authorization", () => {
  const request = new Request("https://example.com/api/cleanup", {
    headers: { authorization: `Bearer ${secret}` },
  });

  assert.equal(isCleanupRequestAuthorized(request, secret), true);
});

test("accepts the legacy manual cleanup header", () => {
  const request = new Request("https://example.com/api/cleanup", {
    headers: { "x-cleanup-key": secret },
  });

  assert.equal(isCleanupRequestAuthorized(request, secret), true);
});

test("rejects missing and invalid cleanup credentials", () => {
  const missing = new Request("https://example.com/api/cleanup");
  const invalid = new Request("https://example.com/api/cleanup", {
    headers: { authorization: "Bearer wrong-secret" },
  });

  assert.equal(isCleanupRequestAuthorized(missing, secret), false);
  assert.equal(isCleanupRequestAuthorized(invalid, secret), false);
});
