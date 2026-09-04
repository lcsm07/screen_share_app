"use client";

import { useEffect, useState } from "react";
import { Track, type LocalParticipant } from "livekit-client";
import {
  normalizeScreenShareSenderStats,
  type ScreenShareSenderStats,
} from "@/lib/screenShare";

const POLL_INTERVAL_MS = 2_000;

/** Polls the local screen-share sender for the currently encoded layer. */
export function useScreenShareStats(
  localParticipant: LocalParticipant,
  enabled: boolean,
): ScreenShareSenderStats[] {
  const [stats, setStats] = useState<ScreenShareSenderStats[]>([]);

  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    const previousStats = new Map<
      string,
      { frameCount: number; timestamp: number }
    >();

    if (!enabled) {
      setStats([]);
      return;
    }

    const poll = async () => {
      if (disposed || requestInFlight) return;
      requestInFlight = true;
      try {
        const publication = localParticipant.getTrackPublication(
          Track.Source.ScreenShare,
        );
        const videoTrack = publication?.videoTrack;
        const senderStats = videoTrack
          ? await readScreenShareSenderStats(videoTrack)
          : [];
        if (!disposed) {
          const normalized =
            senderStats?.map(normalizeScreenShareSenderStats) ?? [];
          const withDerivedFps = normalized.map((stat) => {
            const frameCount = stat.framesEncoded ?? stat.framesSent;
            const prior = previousStats.get(stat.rid);
            let observedFramesPerSecond: number | undefined;

            if (
              frameCount !== undefined &&
              stat.timestamp !== undefined &&
              prior &&
              stat.timestamp > prior.timestamp
            ) {
              const elapsedSeconds = (stat.timestamp - prior.timestamp) / 1000;
              const derived = (frameCount - prior.frameCount) / elapsedSeconds;
              if (Number.isFinite(derived) && derived > 0) {
                observedFramesPerSecond = derived;
              }
            }

            if (frameCount !== undefined && stat.timestamp !== undefined) {
              previousStats.set(stat.rid, {
                frameCount,
                timestamp: stat.timestamp,
              });
            }

            // Browsers report zero while an encoding is paused or CPU
            // constrained. Keep zero out of the UI; a positive observed
            // delta is more useful than that placeholder value.
            const advertisedFramesPerSecond =
              stat.framesPerSecond !== undefined &&
              stat.framesPerSecond > 0
                ? stat.framesPerSecond
                : undefined;

            return {
              ...stat,
              framesPerSecond:
                observedFramesPerSecond ?? advertisedFramesPerSecond,
            };
          });
          setStats(withDerivedFps);
        }
      } catch {
        // Stats can be unavailable briefly while a publication is changing.
        // Keep the last successful sample instead of disrupting the share UI.
      } finally {
        requestInFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      previousStats.clear();
      window.clearInterval(timer);
    };
  }, [enabled, localParticipant]);

  return stats;
}

type RawOutboundVideoStats = RTCOutboundRtpStreamStats & {
  id?: string;
  kind?: string;
  mediaType?: string;
  type?: string;
};

/**
 * Reads raw outbound stats so framesEncoded is available on browsers where
 * framesSent or the advertised framesPerSecond temporarily drops to zero.
 */
async function readScreenShareSenderStats(videoTrack: {
  getRTCStatsReport: () => Promise<RTCStatsReport | undefined>;
  getSenderStats?: () => Promise<
    Array<{
      rid: string;
      frameWidth?: number;
      frameHeight?: number;
      framesPerSecond?: number;
      framesSent?: number;
      timestamp?: number;
      qualityLimitationReason?: string;
    }>
  >;
}) {
  let report: RTCStatsReport | undefined;
  try {
    report = await videoTrack.getRTCStatsReport();
  } catch {
    report = undefined;
  }

  const rawStats: Array<RawOutboundVideoStats & { rid: string }> = [];
  report?.forEach((value) => {
    const stat = value as RawOutboundVideoStats;
    const mediaKind = stat.kind ?? stat.mediaType;
    if (
      stat.type !== "outbound-rtp" ||
      (mediaKind !== undefined && mediaKind !== "video")
    ) {
      return;
    }

    const rid = stat.rid ?? stat.id;
    if (rid) rawStats.push({ ...stat, rid });
  });

  if (rawStats.length > 0) return rawStats;
  if (typeof videoTrack.getSenderStats === "function") {
    return videoTrack.getSenderStats();
  }
  return [];
}
