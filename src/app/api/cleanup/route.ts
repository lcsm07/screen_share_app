import { NextResponse } from "next/server";
import { cleanupInactiveRooms } from "@/lib/cleanup";
import { isCleanupRequestAuthorized } from "@/lib/cleanupAuth";
import { ROOM_TTL_SEC } from "@/lib/livekit";

export const dynamic = "force-dynamic";

async function runCleanup(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !secret) {
    console.error("[cleanup] CRON_SECRET is required in production");
    return NextResponse.json(
      { error: "Cleanup endpoint is not configured" },
      { status: 503 },
    );
  }
  if (secret && !isCleanupRequestAuthorized(req, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const removed = await cleanupInactiveRooms();
  return NextResponse.json({
    removed,
    ttlSec: ROOM_TTL_SEC,
    ts: Date.now(),
  });
}

/** GET /api/cleanup — invoked daily by Vercel Cron. */
export async function GET(req: Request): Promise<NextResponse> {
  return runCleanup(req);
}

/** POST /api/cleanup — retained for authenticated manual cleanup. */
export async function POST(req: Request): Promise<NextResponse> {
  return runCleanup(req);
}
