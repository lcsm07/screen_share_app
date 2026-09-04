"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { useParticipants } from "@livekit/components-react";
import { Send } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { canUseChat } from "@/lib/chat";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn, timeAgo } from "@/lib/utils";
import type { ChatMessage } from "@/types";

export function ChatPanel({
  room,
  nickname,
}: {
  room: Room | null;
  nickname: string;
}) {
  const participants = useParticipants();
  const chatEnabled = canUseChat(participants.length);
  const { messages, sendMessage } = useChat(room, nickname);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !room || !chatEnabled) return;
    setText("");
    await sendMessage(t);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-600">
            No messages yet. Say hi! 👋
          </p>
        )}
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            msg={m}
            isOwn={m.participantIdentity === room?.localParticipant.identity}
          />
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={submit}
        className="flex shrink-0 items-center gap-2 border-t border-zinc-800 p-3"
      >
        <Input
          placeholder={
            chatEnabled ? "Type a message…" : "Waiting for another participant…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          disabled={!room || !chatEnabled}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!room || !chatEnabled || !text.trim()}
          aria-label={chatEnabled ? "Send message" : "Chat is waiting for another participant"}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {!chatEnabled && (
        <p className="shrink-0 px-3 pb-3 text-center text-xs text-zinc-500">
          Chat will be enabled when someone else joins the room.
        </p>
      )}
    </div>
  );
}

function ChatBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  return (
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
      <div className="mb-1 flex items-baseline gap-2">
        <span className={cn("text-xs font-medium", isOwn ? "text-brand-400" : "text-zinc-300")}>
          {msg.nickname}
        </span>
        <span className="text-[10px] text-zinc-600">{timeAgo(msg.ts)}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isOwn
            ? "rounded-br-sm bg-brand-600 text-white"
            : "rounded-bl-sm bg-zinc-800 text-zinc-100",
        )}
      >
        {msg.text}
      </div>
    </div>
  );
}
