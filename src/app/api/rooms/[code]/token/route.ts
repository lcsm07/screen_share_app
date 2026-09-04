import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoomToken, LIVEKIT_URL } from "@/lib/livekit";
import { cleanupInactiveRooms, touchRoom } from "@/lib/cleanup";
import { createId, normalizeRoomCode } from "@/lib/utils";
import type { TokenResponse, ApiError } from "@/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ code: string }>;
}

/** POST /api/rooms/[code]/token — issues a LiveKit token for a nickname. */
export async function POST(req: Request, props: Params): Promise<NextResponse<TokenResponse | ApiError>> {
  const params = await props.params;
  await cleanupInactiveRooms();

  const code = normalizeRoomCode(params.code);
  if (!code) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  let body: { nickname?: string } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // ok
  }

  const nickname = (body.nickname ?? "").trim();
  if (nickname.length < 1 || nickname.length > 32) {
    return NextResponse.json({ error: "Invalid nickname (1–32 characters)" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!room.active) {
    return NextResponse.json({ error: "Room expired" }, { status: 410 });
  }

  await touchRoom(code);

  const token = await createRoomToken({
    roomCode: code,
    // Display names may repeat; the LiveKit identity must not.
    identity: createId(),
    name: nickname,
  });

  return NextResponse.json({
    token,
    url: LIVEKIT_URL,
    roomCode: code,
  });
}
