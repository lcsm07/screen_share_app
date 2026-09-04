import {
  ScreenSharePresets,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";

export type ScreenShareQuality = "auto" | "balanced" | "data-saver";

export interface ScreenShareProfile {
  id: ScreenShareQuality;
  label: string;
  captureOptions: ScreenShareCaptureOptions;
  publishOptions: TrackPublishOptions;
}

export interface ScreenShareSenderStats {
  rid: string;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  framesSent?: number;
  framesEncoded?: number;
  timestamp?: number;
  qualityLimitationReason?: string;
}

/** Keeps only the sender fields needed by the share status UI. */
export function normalizeScreenShareSenderStats(stats: {
  rid: string;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  framesSent?: number;
  framesEncoded?: number;
  timestamp?: number;
  qualityLimitationReason?: string;
}): ScreenShareSenderStats {
  const finite = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  return {
    rid: stats.rid,
    frameWidth: finite(stats.frameWidth),
    frameHeight: finite(stats.frameHeight),
    framesPerSecond: finite(stats.framesPerSecond),
    framesSent: finite(stats.framesSent),
    framesEncoded: finite(stats.framesEncoded),
    timestamp: finite(stats.timestamp),
    qualityLimitationReason: stats.qualityLimitationReason,
  };
}

/** Selects the highest-resolution layer that is currently sending frames. */
export function selectActiveScreenShareStats(
  stats: readonly ScreenShareSenderStats[],
): ScreenShareSenderStats | null {
  const usable = stats.filter(
    (stat) =>
      stat.framesPerSecond !== undefined ||
      stat.frameWidth !== undefined ||
      stat.frameHeight !== undefined ||
      stat.framesSent !== undefined ||
      stat.framesEncoded !== undefined ||
      stat.qualityLimitationReason !== undefined,
  );
  if (usable.length === 0) return null;

  const byResolution = (a: ScreenShareSenderStats, b: ScreenShareSenderStats) =>
    (b.frameWidth ?? 0) * (b.frameHeight ?? 0) -
    (a.frameWidth ?? 0) * (a.frameHeight ?? 0);
  const active = usable
    .filter(
      (stat) =>
        stat.framesPerSecond !== undefined && stat.framesPerSecond > 0,
    )
    .sort(byResolution);
  return (active[0] ?? [...usable].sort(byResolution)[0]) ?? null;
}

export const SCREEN_SHARE_PROFILES: Record<
  ScreenShareQuality,
  ScreenShareProfile
> = {
  auto: {
    id: "auto",
    label: "Auto · 1080p60",
    captureOptions: {
      audio: true,
      resolution: { width: 1920, height: 1080, frameRate: 60 },
      contentHint: "motion",
      systemAudio: "include",
    },
    publishOptions: {
      simulcast: true,
      screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
      screenShareSimulcastLayers: [
        ScreenSharePresets.h360fps15,
        ScreenSharePresets.h720fps30,
      ],
      degradationPreference: "maintain-resolution",
    },
  },
  balanced: {
    id: "balanced",
    label: "Balanced · 1080p30",
    captureOptions: {
      audio: true,
      resolution: { width: 1920, height: 1080, frameRate: 30 },
      contentHint: "detail",
      systemAudio: "include",
    },
    publishOptions: {
      simulcast: true,
      screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
      screenShareSimulcastLayers: [
        ScreenSharePresets.h360fps15,
        ScreenSharePresets.h720fps15,
      ],
      degradationPreference: "maintain-resolution",
    },
  },
  "data-saver": {
    id: "data-saver",
    label: "Data saver · 720p15",
    captureOptions: {
      audio: true,
      resolution: { width: 1280, height: 720, frameRate: 15 },
      contentHint: "detail",
      systemAudio: "include",
    },
    publishOptions: {
      simulcast: true,
      screenShareEncoding: ScreenSharePresets.h720fps15.encoding,
      screenShareSimulcastLayers: [ScreenSharePresets.h360fps3],
      degradationPreference: "maintain-resolution",
    },
  },
};

const FALLBACK_ORDER: Record<ScreenShareQuality, ScreenShareQuality[]> = {
  auto: ["auto", "balanced", "data-saver"],
  balanced: ["balanced", "data-saver"],
  "data-saver": ["data-saver"],
};

export function getScreenShareAttempts(
  quality: ScreenShareQuality,
): ScreenShareProfile[] {
  return FALLBACK_ORDER[quality].map((id) => SCREEN_SHARE_PROFILES[id]);
}

export function isScreenShareConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "OverconstrainedError" ||
      error.name === "ConstraintNotSatisfiedError")
  );
}
