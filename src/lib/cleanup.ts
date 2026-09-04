import { prisma } from "@/lib/prisma";
import {
  closeLiveKitRoom,
  hasConnectedParticipants,
  ROOM_TTL_SEC,
} from "@/lib/livekit";

/**
 * Cleans up expired/inactive room records. Before deleting an active record,
 * it asks LiveKit whether participants are still connected. Runs on room
 * access and can also be triggered by cron via /api/cleanup.
 *
 * Returns the number of rooms removed.
 */
export async function cleanupInactiveRooms(): Promise<number> {
  const cutoff = new Date(Date.now() - ROOM_TTL_SEC * 1000);
  const now = new Date();

  const expired = await prisma.room.findMany({
    where: {
      OR: [
        { active: false },
        { expiresAt: { lte: now } },
        { expiresAt: null, lastActivityAt: { lt: cutoff } },
      ],
    },
    select: { code: true, active: true },
  });

  if (expired.length === 0) return 0;

  const results = await Promise.all(
    expired.map(async ({ code, active }) => {
      if (active) {
        const occupied = await hasConnectedParticipants(code);
        if (occupied === null) return 0;
        if (occupied) {
          await touchRoom(code);
          return 0;
        }
      }

      // Delete conditionally before touching LiveKit. This prevents a cleanup
      // selected from stale data from deleting a room refreshed concurrently.
      const deleted = await prisma.room.deleteMany({
        where: {
          code,
          OR: [
            { active: false },
            { expiresAt: { lte: now } },
            { expiresAt: null, lastActivityAt: { lt: cutoff } },
          ],
        },
      });
      if (deleted.count === 0) return 0;

      await closeLiveKitRoom(code);
      return deleted.count;
    }),
  );

  return results.reduce((total, count) => total + count, 0);
}

/** Marks recent activity in a room (updates lastActivityAt). */
export async function touchRoom(code: string): Promise<void> {
  await prisma.room
    .update({
      where: { code },
      data: {
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + ROOM_TTL_SEC * 1000),
        active: true,
      },
    })
    .catch(() => {
      // Room may no longer exist — ok.
    });
}
