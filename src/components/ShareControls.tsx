"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Activity,
  Check,
  ChevronDown,
  Loader2,
  Monitor,
  MonitorOff,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useScreenShareStats } from "@/hooks/useScreenShareStats";
import {
  getScreenShareAttempts,
  isScreenShareConstraintError,
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

/**
 * Button to start/stop screen sharing for the local participant.
 * Uses localParticipant.setScreenShareEnabled() which internally calls
 * getDisplayMedia().
 */
export function ShareControls() {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [pending, setPending] = useState(false);
  const [audioPending, setAudioPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<ScreenShareQuality>("auto");
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo | null>(null);
  const [canShareScreen, setCanShareScreen] = useState<boolean | null>(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [performanceFallback, setPerformanceFallback] = useState(false);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const cpuLimitedSamplesRef = useRef(0);
  const performanceFallbackInFlightRef = useRef(false);
  const senderStats = useScreenShareStats(
    localParticipant,
    isScreenShareEnabled && showStats,
  );
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
      setPerformanceFallback(false);
      cpuLimitedSamplesRef.current = 0;
      performanceFallbackInFlightRef.current = false;
    }
  }, [isScreenShareEnabled]);

  useEffect(() => {
    if (!isScreenShareEnabled || quality !== "auto") {
      cpuLimitedSamplesRef.current = 0;
      return;
    }

    const isCpuLimitedWithoutFrames =
      activeSenderStats?.qualityLimitationReason === "cpu" &&
      (activeSenderStats.framesPerSecond === undefined ||
        activeSenderStats.framesPerSecond <= 0);
    if (!isCpuLimitedWithoutFrames) {
      cpuLimitedSamplesRef.current = 0;
      return;
    }

    cpuLimitedSamplesRef.current += 1;
    if (
      cpuLimitedSamplesRef.current < 2 ||
      performanceFallback ||
      performanceFallbackInFlightRef.current
    ) {
      return;
    }

    const publication = localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    );
    const videoTrack = publication?.videoTrack;
    if (
      !videoTrack ||
      !("prioritizePerformance" in videoTrack) ||
      typeof videoTrack.prioritizePerformance !== "function"
    ) {
      return;
    }

    performanceFallbackInFlightRef.current = true;
    void videoTrack
      .prioritizePerformance()
      .then(() => setPerformanceFallback(true))
      .catch((error) => {
        console.error("[screen-share] performance fallback error:", error);
      })
      .finally(() => {
        performanceFallbackInFlightRef.current = false;
      });
  }, [
    activeSenderStats,
    isScreenShareEnabled,
    localParticipant,
    performanceFallback,
    quality,
  ]);

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
      } else {
        const attempts = getScreenShareAttempts(quality);
        for (let index = 0; index < attempts.length; index++) {
          const profile = attempts[index];
          try {
            const publication = await localParticipant.setScreenShareEnabled(
              true,
              profile.captureOptions,
              profile.publishOptions,
            );
            const settings =
              publication?.videoTrack?.mediaStreamTrack.getSettings();
            setCaptureInfo({
              width: settings?.width,
              height: settings?.height,
              frameRate: settings?.frameRate,
              profile: profile.id,
            });
            break;
          } catch (attemptError) {
            const hasFallback = index < attempts.length - 1;
            if (!hasFallback || !isScreenShareConstraintError(attemptError)) {
              throw attemptError;
            }
          }
        }
      }
    } catch (err) {
      console.error("[screen-share] error:", err);
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permission denied. Allow screen access in your browser."
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
      if (publication.isMuted) {
        await publication.unmute();
      } else {
        await publication.mute();
      }
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
          <span className="max-w-[9rem] truncate text-zinc-400">
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
              <p className="text-sm font-semibold text-zinc-100">
                Share quality
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Choose the sender&apos;s capture target.
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
            <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-800">
              <input
                type="checkbox"
                checked={showStats}
                onChange={(event) => setShowStats(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-500"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
                  <Activity className="h-3.5 w-3.5 text-brand-300" />
                  Show live FPS
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Display capture and outbound sender stats.
                </span>
              </span>
            </label>
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
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Starting…
          </>
        ) : sharing ? (
          <>
            <MonitorOff className="h-4 w-4" /> Stop sharing
          </>
        ) : (
          <>
            <Monitor className="h-4 w-4" /> Share screen
          </>
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
              ? screenShareAudioMuted
                ? "Enable shared audio"
                : "Mute shared audio"
              : "No shared audio captured"
          }
          aria-label={
            screenShareAudioAvailable
              ? screenShareAudioMuted
                ? "Enable shared audio"
                : "Mute shared audio"
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
              ? screenShareAudioMuted
                ? "Enable audio"
                : "Mute audio"
              : "No audio"}
          </span>
        </Button>
      )}
      {sharing && showStats && (
        <div className="text-xs text-zinc-400" aria-live="polite">
          <span>
            Capture: {formatStreamStats(captureInfo)}
          </span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span>
            Sent: {formatStreamStats(activeSenderStats)}
          </span>
          {captureInfo && captureInfo.profile !== quality && (
            <span className="ml-1.5 text-amber-400">
              · fallback: {SCREEN_SHARE_PROFILES[captureInfo.profile].label}
            </span>
          )}
          {activeSenderStats?.qualityLimitationReason &&
            activeSenderStats.qualityLimitationReason !== "none" && (
              <span className="ml-1.5 text-amber-400">
                · limited by {activeSenderStats.qualityLimitationReason}
              </span>
            )}
          {performanceFallback && (
            <span className="ml-1.5 text-amber-400">
              · performance fallback enabled
            </span>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!sharing && canShareScreen === false && !error && (
        <p className="text-xs text-amber-400">
          Screen sharing requires HTTPS or localhost.
        </p>
      )}
    </div>
  );
}

function formatStreamStats(
  stats:
    | CaptureInfo
    | ReturnType<typeof selectActiveScreenShareStats>
    | null,
): string {
  if (!stats) return "waiting for stats…";

  let width: number | undefined;
  let height: number | undefined;
  let fps: number | undefined;
  if ("profile" in stats) {
    width = stats.width;
    height = stats.height;
    fps = stats.frameRate;
  } else {
    width = stats.frameWidth;
    height = stats.frameHeight;
    fps = stats.framesPerSecond;
  }
  const resolution =
    width !== undefined &&
    height !== undefined &&
    width > 0 &&
    height > 0
      ? `${width}×${height}`
      : "";
  const frameRate =
    fps !== undefined && Number.isFinite(fps) && fps > 0
      ? `${Math.round(fps)} fps`
      : "";

  if (!frameRate) {
    return resolution
      ? `${resolution} · waiting for frames…`
      : "waiting for frames…";
  }

  return [resolution, frameRate].filter(Boolean).join(" @ ");
}
