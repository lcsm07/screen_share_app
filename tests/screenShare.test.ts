import test from "node:test";
import assert from "node:assert/strict";
import {
  getScreenShareAttempts,
  isScreenShareConstraintError,
  normalizeScreenShareSenderStats,
  selectActiveScreenShareStats,
  SCREEN_SHARE_PROFILES,
} from "../src/lib/screenShare";

test("auto prefers 1080p60 and falls back progressively", () => {
  const attempts = getScreenShareAttempts("auto");

  assert.deepEqual(
    attempts.map((profile) => profile.id),
    ["auto", "balanced", "data-saver"],
  );
  assert.deepEqual(attempts[0].captureOptions.resolution, {
    width: 1920,
    height: 1080,
    frameRate: 60,
  });
  assert.equal(attempts[0].captureOptions.audio, true);
  assert.equal(attempts[0].captureOptions.systemAudio, "include");
});

test("data saver uses one low-bandwidth profile", () => {
  assert.deepEqual(
    getScreenShareAttempts("data-saver").map((profile) => profile.id),
    ["data-saver"],
  );
  assert.equal(
    SCREEN_SHARE_PROFILES["data-saver"].publishOptions.screenShareEncoding
      ?.maxBitrate,
    1_500_000,
  );
});

test("only capture constraint failures qualify for automatic fallback", () => {
  const constraintError = new Error("unsupported capture setting");
  constraintError.name = "OverconstrainedError";

  assert.equal(isScreenShareConstraintError(constraintError), true);
  assert.equal(isScreenShareConstraintError(new Error("permission denied")), false);
});

test("sender stats select the highest active outbound layer", () => {
  const selected = selectActiveScreenShareStats([
    {
      rid: "f",
      frameWidth: 1920,
      frameHeight: 1080,
      framesPerSecond: 0,
    },
    {
      rid: "h",
      frameWidth: 1280,
      frameHeight: 720,
      framesPerSecond: 30,
    },
  ]);

  assert.equal(selected?.rid, "h");
  assert.equal(selected?.framesPerSecond, 30);
});

test("invalid sender stats are normalized without rendering NaN values", () => {
  const normalized = normalizeScreenShareSenderStats({
    rid: "f",
    frameWidth: Number.NaN,
    frameHeight: undefined,
    framesPerSecond: Number.NaN,
    framesSent: Number.POSITIVE_INFINITY,
    framesEncoded: undefined,
    timestamp: Number.NaN,
  });

  assert.equal(normalized.rid, "f");
  assert.equal(normalized.frameWidth, undefined);
  assert.equal(normalized.frameHeight, undefined);
  assert.equal(normalized.framesPerSecond, undefined);
  assert.equal(normalized.framesSent, undefined);
  assert.equal(normalized.framesEncoded, undefined);
  assert.equal(normalized.timestamp, undefined);
  assert.equal(selectActiveScreenShareStats([normalized]), null);
});

test("CPU-limited layers remain selectable for a useful status message", () => {
  const selected = selectActiveScreenShareStats([
    { rid: "f", framesPerSecond: 0, qualityLimitationReason: "cpu" },
  ]);

  assert.equal(selected?.rid, "f");
  assert.equal(selected?.qualityLimitationReason, "cpu");
});
