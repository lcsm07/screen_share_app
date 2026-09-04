"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { useLocalParticipant } from "@livekit/components-react";
import {
  LocalVideoTrack,
  Track,
  type LocalTrack,
} from "livekit-client";
import {
  Activity,
  Check,
  ChevronDown,
  GripHorizontal,
  Loader2,
  Monitor,
  MonitorOff,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useScreenShareStats } from "@/hooks/useScreenShareStats";
import {
  SCREEN_SHARE_PROFILES,
  selectActiveScreenShareStats,
  type ScreenShareQuality,
} from "@/lib/screenShare";

interface CaptureInfo {
  width?: number;
  height?: number;
  frameRate?: number;
  profile: ScreenShareQuality;
}

interface ShareControlsProps {
  receivedAudioMuted: boolean;
  diagnosticsContainerRef: MutableRefObject<HTMLDivElement | null>;
  onToggleReceivedAudio: () => void;
}

export function ShareControls({
  receivedAudioMuted,
  diagnosticsContainerRef,
  onToggleReceivedAudio,
}: ShareControlsProps) {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [pending, setPending] = useState(false);
  const [audioPending, setAudioPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<ScreenShareQuality>("1080p60");
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo | null>(null);
  const [canShareScreen, setCanShareScreen] = useState<boolean | null>(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  // Keep diagnostics warm so codec and encoder selection are visible immediately.
  const senderStats = useScreenShareStats(localParticipant, isScreenShareEnabled);
  const activeSenderStats = selectActiveScreenShareStats(senderStats);
  const screenShareAudioPublication = localParticipant.getTrackPublication(
    Track.Source.ScreenShareAudio,
  );
  const screenShareAudioAvailable = Boolean(
    screenShareAudioPublication?.audioTrack,
  );
  const screenShareAudioMuted = screenShareAudioPublication?.isMuted ?? true;

  useEffect(() => {
    if (!qualityMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        qualityMenuRef.current &&
        !qualityMenuRef.current.contains(event.target as Node)
      ) {
        setQualityMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQualityMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [qualityMenuOpen]);

  useEffect(() => {
    setCanShareScreen(
      typeof navigator.mediaDevices?.getDisplayMedia === "function",
    );
  }, []);

  useEffect(() => {
    if (!isScreenShareEnabled) {
      setCaptureInfo(null);
      setDiagnosticsOpen(false);
    }
  }, [isScreenShareEnabled]);

  useEffect(() => {
    if (!diagnosticsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDiagnosticsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [diagnosticsOpen]);

  async function toggle() {
    setError(null);
    if (!isScreenShareEnabled && canShareScreen !== true) {
      setError("Screen sharing requires HTTPS or localhost in your browser.");
      return;
    }

    setPending(true);
    try {
      if (isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
        return;
      }

      const profile = SCREEN_SHARE_PROFILES[quality];
      let acquiredTracks: LocalTrack[] = [];
      try {
        // One picker only. Capture is capped once at the selected target;
        // Chromium then owns real-time output adaptation through WebRTC.
        acquiredTracks = await localParticipant.createScreenTracks(
          profile.captureOptions,
        );
        const videoTrack = acquiredTracks.find(
          (track) => track.kind === Track.Kind.Video,
        );
        if (!(videoTrack instanceof LocalVideoTrack)) {
          throw new Error("No screen video track was captured");
        }

        videoTrack.mediaStreamTrack.contentHint =
          profile.captureOptions.contentHint ?? "motion";
        const target = profile.captureOptions.resolution;
        if (target) {
          await videoTrack.mediaStreamTrack.applyConstraints({
            width: { ideal: target.width, max: target.width },
            height: { ideal: target.height, max: target.height },
            frameRate: { ideal: target.frameRate, max: target.frameRate },
            resizeMode: "crop-and-scale",
          } as MediaTrackConstraints);
        }

        await localParticipant.publishTrack(videoTrack, {
          ...profile.publishOptions,
          source: Track.Source.ScreenShare,
          stream: "screen-share",
        });

        const audioTrack = acquiredTracks.find(
          (track) => track.kind === Track.Kind.Audio,
        );
        if (audioTrack) {
          await localParticipant.publishTrack(audioTrack, {
            source: Track.Source.ScreenShareAudio,
            stream: "screen-share",
          });
        }

        const settings = videoTrack.mediaStreamTrack.getSettings();
        setCaptureInfo({
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          profile: quality,
        });
      } catch (startError) {
        await rollbackTracks(localParticipant, acquiredTracks);
        throw startError;
      }
    } catch (err) {
      console.error("[screen-share] error:", err);
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permission denied. Allow screen access in your browser."
          : err instanceof Error && err.name === "OverconstrainedError"
            ? "This source cannot provide the selected capture mode."
            : "Unable to share screen",
      );
    } finally {
      setPending(false);
    }
  }

  async function toggleScreenShareAudio() {
    setError(null);
    const publication = localParticipant.getTrackPublication(
      Track.Source.ScreenShareAudio,
    );
    if (!publication?.track) {
      setError(
        "No shared audio was captured. Select a source with audio in the browser dialog.",
      );
      return;
    }

    setAudioPending(true);
    try {
      if (publication.isMuted) await publication.unmute();
      else await publication.mute();
    } catch (err) {
      console.error("[screen-share-audio] error:", err);
      setError("Unable to change shared audio");
    } finally {
      setAudioPending(false);
    }
  }

  const sharing = isScreenShareEnabled;
  const selectedProfile = SCREEN_SHARE_PROFILES[quality];

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur">
      <div ref={qualityMenuRef} className="relative">
        <button
          type="button"
          aria-expanded={qualityMenuOpen}
          aria-haspopup="dialog"
          onClick={() => setQualityMenuOpen((open) => !open)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-200 shadow-sm transition-all hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <Settings2 className="h-4 w-4 text-brand-300" />
          <span className="hidden sm:inline">Quality</span>
          <span className="max-w-[11rem] truncate text-zinc-400">
            {selectedProfile.label}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform ${
              qualityMenuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {qualityMenuOpen && (
          <div
            role="dialog"
            aria-label="Screen share quality options"
            className="absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-2xl border border-zinc-700 bg-zinc-900 p-2 text-left shadow-2xl shadow-black/40"
          >
            <div className="px-3 py-2">
              <p className="text-sm font-semibold text-zinc-100">Share quality</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                1080p60 targets Discord-style high-motion sharing.
              </p>
            </div>
            <div className="space-y-1" role="radiogroup" aria-label="Share quality">
              {Object.values(SCREEN_SHARE_PROFILES).map((profile) => {
                const selected = profile.id === quality;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={pending || sharing}
                    onClick={() => {
                      setQuality(profile.id);
                      setQualityMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "bg-brand-600/15 text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected
                          ? "border-brand-400 bg-brand-500 text-white"
                          : "border-zinc-600"
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {profile.label.split(" · ")[0]}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {profile.label.split(" · ")[1]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="my-2 border-t border-zinc-800" />
            <button
              type="button"
              disabled={!sharing}
              onClick={() => {
                setQualityMenuOpen(false);
                setDiagnosticsOpen(true);
              }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
                  Sender diagnostics
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Open capture and encoder details in a modal.
                </span>
              </span>
            </button>
          </div>
        )}
      </div>

      <Button
        onClick={toggle}
        disabled={pending || (!sharing && canShareScreen !== true)}
        variant={sharing ? "danger" : "primary"}
        size="md"
        className="min-w-[200px]"
      >
        {pending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>
        ) : sharing ? (
          <><MonitorOff className="h-4 w-4" /> Stop sharing</>
        ) : (
          <><Monitor className="h-4 w-4" /> Share screen</>
        )}
      </Button>

      {sharing && (
        <Button
          onClick={toggleScreenShareAudio}
          disabled={pending || audioPending || !screenShareAudioAvailable}
          variant="outline"
          size="md"
          title={
            screenShareAudioAvailable
              ? screenShareAudioMuted ? "Enable shared audio" : "Mute shared audio"
              : "No shared audio captured"
          }
          aria-label={
            screenShareAudioAvailable
              ? screenShareAudioMuted ? "Enable shared audio" : "Mute shared audio"
              : "No shared audio captured"
          }
        >
          {audioPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : screenShareAudioMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {screenShareAudioAvailable
              ? screenShareAudioMuted ? "Enable audio" : "Mute audio"
              : "No audio"}
          </span>
        </Button>
      )}

      {!sharing && (
        <Button
          onClick={onToggleReceivedAudio}
          variant="outline"
          size="md"
          title={receivedAudioMuted ? "Unmute received audio" : "Mute received audio"}
          aria-label={receivedAudioMuted ? "Unmute received audio" : "Mute received audio"}
          aria-pressed={receivedAudioMuted}
        >
          {receivedAudioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          <span className="hidden sm:inline">
            {receivedAudioMuted ? "Unmute audio" : "Mute audio"}
          </span>
        </Button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
      {!sharing && canShareScreen === false && !error && (
        <p className="text-xs text-amber-400">
          Screen sharing requires HTTPS or localhost.
        </p>
      )}
      {diagnosticsOpen && (
        <SenderDiagnosticsModal
          captureInfo={captureInfo}
          stats={activeSenderStats}
          containerRef={diagnosticsContainerRef}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </div>
  );
}

function SenderDiagnosticsModal({
  captureInfo,
  stats,
  containerRef,
  onClose,
}: {
  captureInfo: CaptureInfo | null;
  stats: ReturnType<typeof selectActiveScreenShareStats>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const status = diagnoseSender(captureInfo, stats);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const clampToContainer = useCallback((x: number, y: number) => {
    const dialog = dialogRef.current;
    const container = containerRef.current;
    const margin = 12;
    if (!dialog || !container) return { x, y };

    return {
      x: Math.min(
        Math.max(margin, x),
        Math.max(margin, container.clientWidth - dialog.offsetWidth - margin),
      ),
      y: Math.min(
        Math.max(margin, y),
        Math.max(margin, container.clientHeight - dialog.offsetHeight - margin),
      ),
    };
  }, [containerRef]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const container = containerRef.current;
    if (!dialog || !container) return;

    setPosition(clampToContainer(container.clientWidth - dialog.offsetWidth - 24, 16));

    const handleResize = () => {
      setPosition((current) =>
        current ? clampToContainer(current.x, current.y) : current,
      );
    };
    window.addEventListener("resize", handleResize);
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [clampToContainer, containerRef]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const bounds = dialog.getBoundingClientRect();
    if (!containerRef.current) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(
      clampToContainer(
        event.clientX - drag.offsetX - (containerRef.current?.getBoundingClientRect().left ?? 0),
        event.clientY - drag.offsetY - (containerRef.current?.getBoundingClientRect().top ?? 0),
      ),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const container = containerRef.current;
  if (!container) return null;

  return createPortal(
    <div
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sender-diagnostics-title"
        style={position
          ? {
              left: position.x,
              top: position.y,
              maxHeight: Math.max(0, container.clientHeight - 24),
            }
          : { left: 12, top: 12, visibility: "hidden" }}
        className="absolute flex max-h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60"
      >
        <div
          className="flex cursor-grab touch-none select-none items-center justify-between border-b border-zinc-800 px-5 py-4 active:cursor-grabbing"
          onPointerDown={beginDrag}
          onPointerMove={continueDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex min-w-0 items-center gap-3">
            <GripHorizontal className="h-5 w-5 shrink-0 text-zinc-600" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="sender-diagnostics-title" className="font-semibold text-zinc-100">
                Sender diagnostics
              </h2>
              <p className={`mt-1 text-xs ${status.tone}`}>{status.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close diagnostics"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-3 overflow-y-auto px-5 py-5 text-sm">
          <DiagnosticRow
            label="Requested"
            value={captureInfo
              ? `${captureInfo.profile} · ${SCREEN_SHARE_PROFILES[captureInfo.profile].publishOptions.videoCodec?.toUpperCase()}`
              : "Waiting…"}
          />
          <DiagnosticRow label="Capture" value={formatStreamStats(captureInfo)} />
          <DiagnosticRow label="Sent" value={formatStreamStats(stats)} />
          <DiagnosticRow label="Bitrate" value={formatOptionalBitrate(stats?.bitrate)} />
          <DiagnosticRow
            label="Available uplink"
            value={formatOptionalBitrate(stats?.availableOutgoingBitrate)}
          />
          <DiagnosticRow
            label="Round-trip time"
            value={stats?.roundTripTime !== undefined
              ? `${Math.round(stats.roundTripTime * 1000)} ms`
              : "Waiting…"}
          />
          <DiagnosticRow label="Transport" value={formatTransport(stats)} />
          <DiagnosticRow label="Packet loss" value={formatPacketLoss(stats)} />
          <DiagnosticRow
            label="Encode time"
            value={stats?.encodeTimePerFrameMs !== undefined
              ? `${stats.encodeTimePerFrameMs.toFixed(1)} ms/frame`
              : "Waiting…"}
          />
          <DiagnosticRow label="Codec" value={stats?.codec ?? "Waiting…"} />
          <DiagnosticRow
            label="Encoder"
            value={stats?.encoderImplementation ?? "Browser default"}
          />
          <DiagnosticRow
            label="Hardware efficient"
            value={stats?.powerEfficientEncoder === undefined
              ? "Not reported"
              : stats.powerEfficientEncoder ? "Yes" : "No"}
          />
          <DiagnosticRow
            label="Limitation"
            value={stats?.qualityLimitationReason ?? "None reported"}
          />
        </dl>
        <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-500">
          The source stays at the selected capture size. WebRTC balances output
          resolution and frame rate when conditions change.
        </div>
      </div>
    </div>,
    container,
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-mono text-zinc-200">{value}</dd>
    </>
  );
}

async function rollbackTracks(
  participant: ReturnType<typeof useLocalParticipant>["localParticipant"],
  tracks: LocalTrack[],
) {
  await Promise.all(
    tracks.map(async (track) => {
      try {
        const publication = await participant.unpublishTrack(track, true);
        if (!publication) track.stop();
      } catch {
        track.stop();
      }
    }),
  );
}

function diagnoseSender(
  capture: CaptureInfo | null,
  stats: ReturnType<typeof selectActiveScreenShareStats>,
) {
  const expectedCodec = capture
    ? SCREEN_SHARE_PROFILES[capture.profile].publishOptions.videoCodec
    : undefined;
  if (
    expectedCodec &&
    stats?.codec &&
    !stats.codec.toLowerCase().includes(expectedCodec.toLowerCase())
  ) {
    return { label: `Codec fallback: ${stats.codec}`, tone: "text-amber-400" };
  }
  if ((capture?.frameRate ?? 60) < 50 || (stats?.sourceFramesPerSecond ?? 60) < 50) {
    return { label: "Source limited", tone: "text-amber-400" };
  }
  if (stats?.qualityLimitationReason === "cpu") {
    return { label: "Encoder limited", tone: "text-amber-400" };
  }
  if (stats?.qualityLimitationReason === "bandwidth") {
    return { label: "Network limited", tone: "text-amber-400" };
  }
  const capturePixels = (capture?.width ?? 0) * (capture?.height ?? 0);
  const sentPixels = (stats?.frameWidth ?? 0) * (stats?.frameHeight ?? 0);
  if (capturePixels > 0 && sentPixels > 0 && sentPixels < capturePixels * 0.75) {
    return { label: "Encoder reduced resolution", tone: "text-amber-400" };
  }
  if ((stats?.framesPerSecond ?? 0) >= 55) {
    return { label: "60 fps healthy", tone: "text-emerald-400" };
  }
  return { label: "Measuring", tone: "text-zinc-400" };
}

function formatStreamStats(
  stats: CaptureInfo | ReturnType<typeof selectActiveScreenShareStats> | null,
): string {
  if (!stats) return "waiting for stats…";
  const width = "profile" in stats ? stats.width : stats.frameWidth;
  const height = "profile" in stats ? stats.height : stats.frameHeight;
  const fps = "profile" in stats ? stats.frameRate : stats.framesPerSecond;
  const resolution =
    width !== undefined && height !== undefined && width > 0 && height > 0
      ? `${width}×${height}`
      : "";
  const frameRate =
    fps !== undefined && Number.isFinite(fps) && fps > 0
      ? `${Math.round(fps)} fps`
      : "";
  if (!frameRate) {
    return resolution ? `${resolution} · waiting for frames…` : "waiting for frames…";
  }
  return [resolution, frameRate].filter(Boolean).join(" @ ");
}

function formatBitrate(value: number) {
  return value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)} Mbps`
    : `${Math.round(value / 1000)} kbps`;
}

function formatOptionalBitrate(value?: number) {
  return value !== undefined && Number.isFinite(value)
    ? formatBitrate(value)
    : "Waiting…";
}

function formatTransport(
  stats: ReturnType<typeof selectActiveScreenShareStats>,
) {
  if (!stats?.transportProtocol) return "Waiting…";
  const route = [stats.localCandidateType, stats.remoteCandidateType]
    .filter(Boolean)
    .join(" → ");
  return [stats.transportProtocol.toUpperCase(), route]
    .filter(Boolean)
    .join(" · ");
}

function formatPacketLoss(
  stats: ReturnType<typeof selectActiveScreenShareStats>,
) {
  if (stats?.packetsLost === undefined) return "Waiting…";
  const total = (stats.packetsSent ?? 0) + stats.packetsLost;
  if (total <= 0) return `${stats.packetsLost} packets`;
  return `${((stats.packetsLost / total) * 100).toFixed(2)}% · ${stats.packetsLost} packets`;
}
