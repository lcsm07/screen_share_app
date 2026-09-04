"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import { Monitor, ArrowLeft, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { RoomView } from "@/components/RoomView";
import type { TokenResponse, ApiError, RoomInfo } from "@/types";

const NICKNAME_KEY = "ssr:nickname";

export function RoomGate({ code }: { code: string }) {
  const router = useRouter();
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  // Check if the room exists.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
        if (!active) return;
        if (res.status === 404 || res.status === 410) {
          setNotFound(true);
          return;
        }
        const data = (await res.json()) as RoomInfo | ApiError;
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Unable to check room");
        }
        setRoomInfo(data);
      } catch {
        if (active) setError("Unable to check the room. Please try again.");
      } finally {
        if (active) setLoadingInfo(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  // Pre-fill saved nickname.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(NICKNAME_KEY) : null;
    if (saved) setNickname(saved);
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > 32) {
      setError("Nickname must be between 1 and 32 characters");
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${code}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      });
      const data: TokenResponse | ApiError = await res.json();
      if (!res.ok || "error" in data) {
        throw new Error((data as ApiError).error ?? "Unable to join");
      }
      localStorage.setItem(NICKNAME_KEY, trimmed);
      setToken(data.token);
      setServerUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setJoining(false);
    }
  }

  // Initial loading.
  if (loadingInfo) {
    return (
      <Centered>
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <p className="text-sm text-zinc-400">Checking room…</p>
      </Centered>
    );
  }

  // Room not found.
  if (notFound) {
    return (
      <Centered>
        <Card className="max-w-md text-center">
          <p className="mb-2 text-4xl">🔍</p>
          <h2 className="mb-2 text-xl font-semibold">Room not found</h2>
          <p className="mb-6 text-sm text-zinc-400">
            The room <span className="font-mono text-zinc-200">{code}</span> does
            not exist or has expired.
          </p>
          <Button onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Button>
        </Card>
      </Centered>
    );
  }

  if (!roomInfo) {
    return (
      <Centered>
        <Card className="max-w-md text-center">
          <h2 className="mb-2 text-xl font-semibold">Connection problem</h2>
          <p className="mb-6 text-sm text-zinc-400">{error}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </Card>
      </Centered>
    );
  }

  // Connected — render the room.
  if (token && serverUrl) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        audio={false}
        video={false}
        options={{ dynacast: true, adaptiveStream: true }}
        onDisconnected={() => {
          setToken(null);
          setServerUrl(null);
        }}
        onError={(e) => {
          console.error("[livekit] error:", e);
          setError(e.message);
        }}
        style={{ height: "100%" }}
      >
        <RoomView code={code} roomName={roomInfo?.name ?? code} nickname={nickname.trim()} />
      </LiveKitRoom>
    );
  }

  // Nickname gate.
  return (
    <Centered>
      <Card className="w-full max-w-md animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/20 text-brand-400">
            <Monitor className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Join room</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Room <span className="font-mono text-zinc-200">{code}</span> · enter
            your nickname
          </p>
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <Input
            placeholder="Your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={32}
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" size="lg" disabled={joining}>
            {joining ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
              </>
            ) : (
              <>
                <Users className="h-4 w-4" /> Join
              </>
            )}
          </Button>
        </form>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      {children}
    </main>
  );
}
