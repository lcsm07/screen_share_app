"use client";

import { useParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { User, Monitor, Mic, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ParticipantList() {
  const participants = useParticipants();

  const local = participants.find((p) => p.isLocal);
  const remotes = participants.filter((p) => !p.isLocal);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {/* Count */}
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
        <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 animate-pulse-soft" />
        <span>{participants.length} participant(s) connected</span>
      </div>

      <Section title="You">
        {local && <ParticipantRow p={local} />}
      </Section>

      <Section title="Participants">
        {remotes.length === 0 ? (
          <p className="text-sm text-zinc-600">No one else here yet.</p>
        ) : (
          remotes.map((p) => <ParticipantRow key={p.identity} p={p} />)
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

type ParticipantLike = ReturnType<typeof useParticipants>[number];

function ParticipantRow({ p }: { p: ParticipantLike }) {
  const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
  const micPub = p.getTrackPublication(Track.Source.Microphone);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        p.isSpeaking ? "bg-zinc-800/80" : "hover:bg-zinc-800/40",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
        <User className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">
          {p.name ?? p.identity}
          {p.isLocal && (
            <span className="ml-2 text-xs text-zinc-500">(you)</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {micPub && (
          <Mic className="h-3.5 w-3.5 text-zinc-500" />
        )}
        {screenPub && (
          <span className="flex items-center gap-1 rounded bg-brand-600/20 px-1.5 py-0.5 text-[10px] text-brand-300">
            <Monitor className="h-3 w-3" /> screen
          </span>
        )}
      </div>
    </div>
  );
}
