"use client";

import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTracks, VideoTrack } from "@livekit/components-react";
import { Maximize2, Minimize2, MonitorOff } from "lucide-react";

/**
 * Renders the shared screen (local or remote) as the main element.
 * Uses useTracks([ScreenShare]) to get tracks published by any
 * participant.
 */
export function ScreenShareView() {
  // TrackReference[] — real tracks (published and subscribed)
  const screenTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    const element = viewportRef.current;
    const supported =
      typeof document.exitFullscreen === "function" &&
      typeof element?.requestFullscreen === "function";
    setFullscreenSupported(supported);

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (
      screenTracks.length === 0 &&
      document.fullscreenElement === viewportRef.current
    ) {
      void document.exitFullscreen().catch(() => {});
    }
  }, [screenTracks.length]);

  async function toggleFullscreen() {
    const element = viewportRef.current;
    if (!element || !fullscreenSupported) return;

    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        await element.requestFullscreen();
      }
    } catch (error) {
      console.error("[screen-share] fullscreen error:", error);
    }
  }

  return (
    <div ref={viewportRef} className="relative min-h-0 flex-1 bg-black">
      {screenTracks.length > 0 ? (
        <>
          <div
            className={
              screenTracks.length === 1
                ? "h-full"
                : "grid h-full auto-rows-fr grid-cols-1 gap-px bg-zinc-800 lg:grid-cols-2"
            }
          >
            {screenTracks.map((track) => (
              <div
                key={track.publication.trackSid}
                className="relative min-h-0 min-w-0 bg-black"
              >
                <VideoTrack
                  trackRef={track}
                  className="h-full w-full object-contain"
                />
                <div className="absolute left-3 top-3 rounded-md bg-black/60 px-2.5 py-1 text-xs text-zinc-200 backdrop-blur">
                  {track.participant.name ?? track.participant.identity} is sharing
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            disabled={!fullscreenSupported}
            aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            aria-pressed={isFullscreen}
            title={
              fullscreenSupported
                ? isFullscreen
                  ? "Exit fullscreen"
                  : "View fullscreen"
                : "Fullscreen is not supported in this browser"
            }
            className="absolute right-3 top-3 z-20 inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-black/70 px-3 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:border-white/30 hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </span>
          </button>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
          <MonitorOff className="h-12 w-12" />
          <p className="text-sm">No one is sharing their screen</p>
          <p className="text-xs text-zinc-700">
            Use the button below to start sharing
          </p>
        </div>
      )}
    </div>
  );
}
