import test from "node:test";
import assert from "node:assert/strict";
import {
  getScreenShareAttempts,
  isScreenShareConstraintError,
  normalizeScreenShareSenderStats,
  selectActiveScreenShareStats,
  SCREEN_SHARE_PROFILES,
} from "../src/lib/screenShare";

test("1080p60 keeps motion-first fallback ordering", () => {
  const attempts = getScreenShareAttempts("1080p60");

  assert.deepEqual(
    attempts.map((profile) => profile.id),
    ["1080p60", "720p60", "1080p30", "720p30"],
  );
  assert.deepEqual(attempts[0].captureOptions.resolution, {
    width: 1920,
    height: 1080,
    frameRate: 60,
  });
  assert.equal(attempts[0].captureOptions.audio, true);
  assert.equal(attempts[0].captureOptions.systemAudio, "include");
  assert.equal(
    attempts[0].publishOptions.screenShareEncoding?.maxFramerate,
    60,
  );
  assert.equal(
    attempts[0].publishOptions.degradationPreference,
    "maintain-resolution",
  );
  assert.equal(attempts[0].publishOptions.videoCodec, "h264");
  assert.equal(attempts[0].publishOptions.backupCodec, false);
  assert.equal(attempts[0].publishOptions.simulcast, false);
});

test("720p60 uses the five megabit motion profile", () => {
  const profile = SCREEN_SHARE_PROFILES["720p60"];

  assert.equal(profile.publishOptions.screenShareEncoding?.maxBitrate, 5_000_000);
  assert.equal(profile.publishOptions.screenShareEncoding?.maxFramerate, 60);
  assert.equal(profile.captureOptions.contentHint, "motion");
  assert.equal(profile.publishOptions.videoCodec, "h264");
  assert.equal(profile.publishOptions.simulcast, false);
});

test("720p30 uses one low-bandwidth profile", () => {
  assert.deepEqual(
    getScreenShareAttempts("720p30").map((profile) => profile.id),
    ["720p30"],
  );
  assert.equal(
    SCREEN_SHARE_PROFILES["720p30"].publishOptions.screenShareEncoding
      ?.maxBitrate,
    2_000_000,
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
