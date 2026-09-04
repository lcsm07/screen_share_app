import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanupInactiveRooms, touchRoom } from "@/lib/cleanup";
import { normalizeRoomCode } from "@/lib/utils";
import type { RoomInfo, ApiError } from "@/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ code: string }>;
}

/** GET /api/rooms/[code] — validates if a room exists and is active. */
export async function GET(_req: Request, props: Params): Promise<NextResponse<RoomInfo | ApiError>> {
  const params = await props.params;
  await cleanupInactiveRooms();

  const code = normalizeRoomCode(params.code);
  if (!code) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (!room.active) {
    return NextResponse.json({ error: "Room expired" }, { status: 410 });
  }

  return NextResponse.json({
    code: room.code,
    name: room.name,
    active: room.active,
    createdAt: room.createdAt.toISOString(),
  });
}

/** PATCH /api/rooms/[code] — heartbeat for a connected room client. */
export async function PATCH(
  _req: Request,
  props: Params,
): Promise<NextResponse<ApiError | null>> {
  const params = await props.params;
  const code = normalizeRoomCode(params.code);
  if (!code) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code } });
  if (!room || !room.active) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  await touchRoom(code);
  return new NextResponse(null, { status: 204 });
}
