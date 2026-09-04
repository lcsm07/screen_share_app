"use client";

import { useEffect, useState } from "react";
import { Track, type LocalParticipant } from "livekit-client";
import {
  normalizeScreenShareSenderStats,
  type ScreenShareSenderStats,
} from "@/lib/screenShare";

const POLL_INTERVAL_MS = 1_000;

type CounterSample = {
  bytes?: number;
  frames?: number;
  totalTime?: number;
  timestamp: number;
};

type RawStats = Record<string, unknown> & {
  id: string;
  type: string;
  timestamp: number;
  kind?: string;
  mediaType?: string;
  rid?: string;
  remoteId?: string;
  codecId?: string;
  selectedCandidatePairId?: string;
  state?: string;
  nominated?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
  protocol?: string;
  candidateType?: string;
  bytesSent?: number;
  packetsSent?: number;
  framesSent?: number;
  framesEncoded?: number;
  framesPerSecond?: number;
  frameWidth?: number;
  frameHeight?: number;
  totalEncodeTime?: number;
  qualityLimitationReason?: string;
  availableOutgoingBitrate?: number;
  currentRoundTripTime?: number;
  roundTripTime?: number;
  packetsLost?: number;
  mimeType?: string;
  encoderImplementation?: string;
  powerEfficientEncoder?: boolean;
};

/** Polls capture, encoder, remote feedback, and transport stats for screen share. */
export function useScreenShareStats(
  localParticipant: LocalParticipant,
  enabled: boolean,
): ScreenShareSenderStats[] {
  const [stats, setStats] = useState<ScreenShareSenderStats[]>([]);

  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    const previous = new Map<string, CounterSample>();

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
        const report = await publication?.videoTrack?.getRTCStatsReport();
        if (!report || disposed) return;

        const all = new Map<string, RawStats>();
        report.forEach((value) => {
          const stat = value as RawStats;
          all.set(stat.id, stat);
        });

        const source = [...all.values()].find(
          (stat) =>
            stat.type === "media-source" &&
            (stat.kind === "video" || stat.mediaType === "video"),
        );
        const transport = [...all.values()].find(
          (stat) => stat.type === "transport" && stat.selectedCandidatePairId,
        );
        const pair = transport?.selectedCandidatePairId
          ? all.get(transport.selectedCandidatePairId)
          : [...all.values()].find(
              (stat) =>
                stat.type === "candidate-pair" &&
                stat.state === "succeeded" &&
              stat.nominated,
            );
        const localCandidate = pair?.localCandidateId
          ? all.get(pair.localCandidateId)
          : undefined;
        const remoteCandidate = pair?.remoteCandidateId
          ? all.get(pair.remoteCandidateId)
          : undefined;

        const normalized = [...all.values()]
          .filter(
            (stat) =>
              stat.type === "outbound-rtp" &&
              (stat.kind === undefined || stat.kind === "video") &&
              (stat.mediaType === undefined || stat.mediaType === "video"),
          )
          .map((stat) => {
            const prior = previous.get(stat.id);
            const elapsedSeconds = prior
              ? (stat.timestamp - prior.timestamp) / 1000
              : 0;
            const frameCount = stat.framesEncoded ?? stat.framesSent;
            const framesDelta =
              prior?.frames !== undefined && frameCount !== undefined
                ? frameCount - prior.frames
                : undefined;
            const bytesDelta =
              prior?.bytes !== undefined && stat.bytesSent !== undefined
                ? stat.bytesSent - prior.bytes
                : undefined;
            const encodeTimeDelta =
              prior?.totalTime !== undefined && stat.totalEncodeTime !== undefined
                ? stat.totalEncodeTime - prior.totalTime
                : undefined;
            const observedFps =
              framesDelta !== undefined && elapsedSeconds > 0
                ? framesDelta / elapsedSeconds
                : undefined;
            const remote = stat.remoteId ? all.get(stat.remoteId) : undefined;
            const codec = stat.codecId ? all.get(stat.codecId) : undefined;

            previous.set(stat.id, {
              bytes: stat.bytesSent,
              frames: frameCount,
              totalTime: stat.totalEncodeTime,
              timestamp: stat.timestamp,
            });

            return normalizeScreenShareSenderStats({
              rid: stat.rid ?? stat.id,
              frameWidth: stat.frameWidth,
              frameHeight: stat.frameHeight,
              framesPerSecond:
                observedFps && observedFps > 0
                  ? observedFps
                  : stat.framesPerSecond,
              sourceFramesPerSecond: source?.framesPerSecond,
              framesSent: stat.framesSent,
              framesEncoded: stat.framesEncoded,
              bytesSent: stat.bytesSent,
              bitrate:
                bytesDelta !== undefined && elapsedSeconds > 0
                  ? (bytesDelta * 8) / elapsedSeconds
                  : undefined,
              encodeTimePerFrameMs:
                encodeTimeDelta !== undefined &&
                framesDelta !== undefined &&
                framesDelta > 0
                  ? (encodeTimeDelta * 1000) / framesDelta
                  : undefined,
              timestamp: stat.timestamp,
              qualityLimitationReason: stat.qualityLimitationReason,
              availableOutgoingBitrate: pair?.availableOutgoingBitrate,
              roundTripTime:
                remote?.roundTripTime ?? pair?.currentRoundTripTime,
              packetsSent: stat.packetsSent,
              packetsLost: remote?.packetsLost,
              transportProtocol: pair?.protocol ?? localCandidate?.protocol,
              localCandidateType: localCandidate?.candidateType,
              remoteCandidateType: remoteCandidate?.candidateType,
              codec: codec?.mimeType,
              encoderImplementation: stat.encoderImplementation,
              powerEfficientEncoder: stat.powerEfficientEncoder,
            });
          });

        if (!disposed) setStats(normalized);
      } catch {
        // Reports can disappear briefly while layers are enabled or disabled.
      } finally {
        requestInFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      previous.clear();
      window.clearInterval(timer);
    };
  }, [enabled, localParticipant]);

  return stats;
}
