"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Plus, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import type { RoomResponse, ApiError } from "@/types";

export function HomeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data: RoomResponse | ApiError = await res.json();
      if (!res.ok || "error" in data) {
        throw new Error((data as ApiError).error ?? "Failed to create room");
      }
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError("Enter a valid room code");
      return;
    }
    setError(null);
    setJoining(true);
    router.push(`/room/${trimmed}`);
  }

  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      {/* Create room */}
      <Card className="flex flex-col animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600/20 text-brand-400">
              <Plus className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Create room</CardTitle>
              <CardDescription>Start a new screen sharing room</CardDescription>
            </div>
          </div>
        </CardHeader>
        <p className="mb-6 text-sm text-zinc-400">
          Generate a unique link and invite participants anonymously. No sign-up,
          no login.
        </p>
        <Button
          onClick={handleCreate}
          disabled={creating}
          size="lg"
          className="mt-auto w-full"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Monitor className="h-4 w-4" /> Create room
            </>
          )}
        </Button>
      </Card>

      {/* Join with code */}
      <Card className="flex flex-col animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <ArrowRight className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Join with code</CardTitle>
              <CardDescription>Use a code received from a friend</CardDescription>
            </div>
          </div>
        </CardHeader>
        <form onSubmit={handleJoin} className="mt-auto flex flex-col gap-3">
          <Input
            placeholder="EX: A4B9XZ"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            className="text-center text-lg tracking-widest font-mono"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <Button type="submit" variant="outline" size="lg" disabled={joining}>
            {joining ? "Joining…" : "Join room"}
          </Button>
        </form>
      </Card>

      {error && (
        <p className="text-sm text-red-400 md:col-span-2 md:text-center">
          {error}
        </p>
      )}
    </div>
  );
}
