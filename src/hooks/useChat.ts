"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, type Participant } from "livekit-client";
import { registerMessageId } from "@/lib/chat";
import { createId } from "@/lib/utils";
import type { ChatMessage } from "@/types";

const CHAT_TOPIC = "screenshare-chat";

/**
 * Real-time chat over the LiveKit data channel.
 * Each message is a JSON {id, nickname, text, ts} published with
 * publishData({reliable:true}) and received via RoomEvent.DataReceived.
 *
 * The hook receives the Room instance explicitly (decoupled from the
 * @livekit/components-react context) to facilitate testing and reuse.
 */
export function useChat(room: Room | null, nickname: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const pushMessage = useCallback((msg: ChatMessage) => {
    if (!registerMessageId(seenIds.current, msg.id)) return;

    setMessages((prev) => {
      // limit in-memory history
      const next = [...prev, msg];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  // Subscribe to messages received from other participants.
  useEffect(() => {
    if (!room) return;

    const onData = (
      payload: Uint8Array,
      participant?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== CHAT_TOPIC || !participant) return;
      try {
        const value: unknown = JSON.parse(new TextDecoder().decode(payload));
        if (!value || typeof value !== "object") return;
        const msg = value as Partial<ChatMessage>;
        if (
          typeof msg.id !== "string" ||
          msg.id.length < 1 ||
          msg.id.length > 100 ||
          typeof msg.text !== "string"
        ) return;

        const text = msg.text.trim().slice(0, 1000);
        if (!text) return;
        const now = Date.now();
        const timestampIsReasonable =
          typeof msg.ts === "number" &&
          Number.isFinite(msg.ts) &&
          Math.abs(now - msg.ts) < 24 * 60 * 60 * 1000;

        pushMessage({
          id: msg.id,
          participantIdentity: participant.identity,
          nickname: participant.name || "Anonymous",
          text,
          ts: timestampIsReasonable ? msg.ts! : now,
        });
      } catch {
        // invalid payload — ignore
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, pushMessage]);

  // Send a message.
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !room) return;

      const msg: ChatMessage = {
        id: createId(),
        participantIdentity: room.localParticipant.identity,
        nickname,
        text: trimmed.slice(0, 1000),
        ts: Date.now(),
      };

      // Immediate local echo (LiveKit does not send back to sender).
      pushMessage(msg);

      try {
        const data = new TextEncoder().encode(JSON.stringify(msg));
        await room.localParticipant.publishData(data, {
          reliable: true,
          topic: CHAT_TOPIC,
        });
      } catch (err) {
        console.warn("[chat] failed to send:", err);
      }
    },
    [room, nickname, pushMessage],
  );

  return { messages, sendMessage };
}
