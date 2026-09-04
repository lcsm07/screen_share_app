"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RoomAudioRenderer, useRoomContext } from "@livekit/components-react";
import { LogOut, Copy, Check, Monitor } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScreenShareView } from "@/components/ScreenShareView";
import { ShareControls } from "@/components/ShareControls";
import { ChatPanel } from "@/components/ChatPanel";
import { ParticipantList } from "@/components/ParticipantList";
import { copyText } from "@/lib/clipboard";

import "@livekit/components-styles";

export function RoomView({
  code,
  roomName,
  nickname,
}: {
  code: string;
  roomName: string;
  nickname: string;
}) {
  const room = useRoomContext();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [receivedAudioMuted, setReceivedAudioMuted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<"chat" | "participants" | null>(
    "chat",
  );

  // Keep the persistent room record alive while this client is connected.
  useEffect(() => {
    const heartbeat = () => {
      void fetch(`/api/rooms/${code}`, { method: "PATCH", keepalive: true }).catch(
        () => {},
      );
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, [code]);

  async function copyLink() {
    const url = `${window.location.origin}/room/${code}`;
    const didCopy = await copyText(url);
    setCopyError(!didCopy);
    if (didCopy) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleLeave() {
    room.disconnect(true).catch(() => {});
    router.push("/");
  }

  return (
    <div className="flex h-screen flex-col">
      <RoomAudioRenderer muted={receivedAudioMuted} />
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Monitor className="h-4 w-4" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-medium text-zinc-100">{roomName}</span>
            <span className="text-xs font-mono text-zinc-500">#{code}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
          </Button>
          {copyError && (
            <span className="text-xs text-red-400" role="status">
              Copy unavailable
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleLeave}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Main area: shared screen + controls */}
        <main className="flex min-h-0 min-w-0 flex-[3] flex-col">
          <ScreenShareView />
          <ShareControls
            receivedAudioMuted={receivedAudioMuted}
            onToggleReceivedAudio={() =>
              setReceivedAudioMuted((muted) => !muted)
            }
          />
        </main>

        {/* Sidebar */}
        <aside className="flex min-h-0 w-full flex-[2] flex-col border-t border-zinc-800 bg-zinc-950/60 md:w-80 md:max-w-sm md:flex-none md:border-l md:border-t-0">
          {/* Tabs */}
          <div className="flex shrink-0 border-b border-zinc-800">
            <SidebarTab
              active={sidebarOpen === "chat"}
              onClick={() => setSidebarOpen("chat")}
              label="Chat"
            />
            <SidebarTab
              active={sidebarOpen === "participants"}
              onClick={() => setSidebarOpen("participants")}
              label="Participants"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {sidebarOpen === "chat" ? (
              <ChatPanel room={room} nickname={nickname} />
            ) : (
              <ParticipantList />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SidebarTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-brand-500 text-zinc-100"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
