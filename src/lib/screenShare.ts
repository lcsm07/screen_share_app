import {
  VideoPreset,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";

export type ScreenShareQuality = "1080p60" | "1080p30" | "720p60" | "720p30";

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
  sourceFramesPerSecond?: number;
  framesSent?: number;
  framesEncoded?: number;
  bytesSent?: number;
  bitrate?: number;
  encodeTimePerFrameMs?: number;
  timestamp?: number;
  qualityLimitationReason?: string;
  availableOutgoingBitrate?: number;
  roundTripTime?: number;
  packetsSent?: number;
  packetsLost?: number;
  transportProtocol?: string;
  localCandidateType?: string;
  remoteCandidateType?: string;
  codec?: string;
  encoderImplementation?: string;
  powerEfficientEncoder?: boolean;
}

const CAPTURE_TARGETS = {
  "1080p": { width: 1920, height: 1080, frameRate: 60 },
  "720p": { width: 1280, height: 720, frameRate: 60 },
} as const;

export const SCREEN_SHARE_PROFILES: Record<
  ScreenShareQuality,
  ScreenShareProfile
> = {
  "720p60": {
    id: "720p60",
    label: "720p60 · Smooth",
    captureOptions: {
      audio: true,
      resolution: CAPTURE_TARGETS["720p"],
      contentHint: "motion",
      systemAudio: "include",
    },
    publishOptions: {
      // A single H.264 stream gives Chromium the best chance of using its
      // hardware encoder. Multiple 60 fps simulcast encodes can exhaust the
      // 16.7 ms/frame budget even when bandwidth is plentiful.
      videoCodec: "h264",
      backupCodec: false,
      simulcast: false,
      screenShareEncoding: {
        maxBitrate: 5_000_000,
        maxFramerate: 60,
        priority: "high",
      },
      // Discord-style compromise: let WebRTC trade some frames and some
      // resolution instead of collapsing all the way to a tiny 60 fps layer.
      degradationPreference: "balanced",
    },
  },
  "1080p60": {
    id: "1080p60",
    label: "1080p60 · High motion",
    captureOptions: {
      audio: true,
      resolution: CAPTURE_TARGETS["1080p"],
      contentHint: "motion",
      systemAudio: "include",
    },
    publishOptions: {
      videoCodec: "h264",
      backupCodec: false,
      simulcast: false,
      screenShareEncoding: {
        maxBitrate: 8_000_000,
        maxFramerate: 60,
        priority: "high",
      },
      // Never turn a sharp 1080p source into an unreadable 480×270 stream.
      // Under pressure Chromium must reduce frame rate before resolution.
      degradationPreference: "maintain-resolution",
    },
  },
  "1080p30": {
    id: "1080p30",
    label: "1080p30 · Sharp",
    captureOptions: {
      audio: true,
      resolution: { width: 1920, height: 1080, frameRate: 30 },
      contentHint: "detail",
      systemAudio: "include",
    },
    publishOptions: {
      videoCodec: "vp8",
      backupCodec: false,
      simulcast: true,
      screenShareEncoding: {
        maxBitrate: 5_000_000,
        maxFramerate: 30,
        priority: "high",
      },
      screenShareSimulcastLayers: [
        new VideoPreset(640, 360, 600_000, 15, "high"),
        new VideoPreset(1280, 720, 2_000_000, 30, "high"),
      ],
      degradationPreference: "maintain-resolution",
    },
  },
  "720p30": {
    id: "720p30",
    label: "720p30 · Lower bandwidth",
    captureOptions: {
      audio: true,
      resolution: { width: 1280, height: 720, frameRate: 30 },
      contentHint: "motion",
      systemAudio: "include",
    },
    publishOptions: {
      videoCodec: "vp8",
      backupCodec: false,
      simulcast: true,
      screenShareEncoding: {
        maxBitrate: 2_000_000,
        maxFramerate: 30,
        priority: "high",
      },
      screenShareSimulcastLayers: [
        new VideoPreset(640, 360, 500_000, 15, "high"),
      ],
      degradationPreference: "maintain-framerate",
    },
  },
};

const FALLBACK_ORDER: Record<ScreenShareQuality, ScreenShareQuality[]> = {
  "1080p60": ["1080p60", "720p60", "1080p30", "720p30"],
  "1080p30": ["1080p30", "720p30"],
  "720p60": ["720p60", "720p30"],
  "720p30": ["720p30"],
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

/** Keeps only the sender fields needed by the share status UI. */
export function normalizeScreenShareSenderStats(
  stats: ScreenShareSenderStats,
): ScreenShareSenderStats {
  const finite = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  return {
    ...stats,
    frameWidth: finite(stats.frameWidth),
    frameHeight: finite(stats.frameHeight),
    framesPerSecond: finite(stats.framesPerSecond),
    sourceFramesPerSecond: finite(stats.sourceFramesPerSecond),
    framesSent: finite(stats.framesSent),
    framesEncoded: finite(stats.framesEncoded),
    bytesSent: finite(stats.bytesSent),
    bitrate: finite(stats.bitrate),
    encodeTimePerFrameMs: finite(stats.encodeTimePerFrameMs),
    timestamp: finite(stats.timestamp),
    availableOutgoingBitrate: finite(stats.availableOutgoingBitrate),
    roundTripTime: finite(stats.roundTripTime),
    packetsSent: finite(stats.packetsSent),
    packetsLost: finite(stats.packetsLost),
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
      (stat) => stat.framesPerSecond !== undefined && stat.framesPerSecond > 0,
    )
    .sort(byResolution);
  return (active[0] ?? [...usable].sort(byResolution)[0]) ?? null;
}
