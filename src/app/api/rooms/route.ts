import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LIVEKIT_URL, ROOM_TTL_SEC } from "@/lib/livekit";
import { cleanupInactiveRooms } from "@/lib/cleanup";
import { generateRoomCode } from "@/lib/utils";
import type { RoomResponse, ApiError } from "@/types";

export const dynamic = "force-dynamic";

/** POST /api/rooms — creates an anonymous room. */
export async function POST(req: Request): Promise<NextResponse<RoomResponse | ApiError>> {
  // Lazy cleanup before creating.
  await cleanupInactiveRooms();

  let body: { name?: string } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // empty body is valid
  }

  const name = body.name?.trim() || null;
  if (name && name.length > 80) {
    return NextResponse.json(
      { error: "Room name must be at most 80 characters" },
      { status: 400 },
    );
  }

  // Create atomically and retry on the rare unique-code collision.
  let room = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    try {
      room = await prisma.room.create({
        data: {
          code,
          name,
          active: true,
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + ROOM_TTL_SEC * 1000),
        },
      });
      break;
    } catch (err) {
      const collision =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!collision) throw err;
    }
  }

  if (!room) {
    return NextResponse.json(
      { error: "Failed to generate unique code" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    code: room.code,
    url: LIVEKIT_URL,
    createdAt: room.createdAt.toISOString(),
  });
}
