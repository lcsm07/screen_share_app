import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} not defined in environment`);
  return value;
}

export const LIVEKIT_URL = requiredEnv("LIVEKIT_URL");
export const LIVEKIT_API_KEY = requiredEnv("LIVEKIT_API_KEY");
export const LIVEKIT_API_SECRET = requiredEnv("LIVEKIT_API_SECRET");

const configuredRoomTtl = Number(process.env.ROOM_INACTIVITY_TTL_SEC ?? "3600");
export const ROOM_TTL_SEC =
  Number.isFinite(configuredRoomTtl) && configuredRoomTtl >= 60
    ? configuredRoomTtl
    : 3600;

/**
 * Generates a JWT token for an anonymous participant to join a LiveKit room.
 * The LiveKit room name corresponds to the room code.
 */
export async function createRoomToken(params: {
  roomCode: string;
  identity: string;
  name?: string;
}): Promise<string> {
  const { roomCode, identity, name } = params;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    // Rooms last as long as there are participants; DB TTL controls the record.
    ttl: "2h",
  });

  at.addGrant({
    room: roomCode,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
    canPublishData: true,
    canSubscribe: true,
    // The MVP has no authenticated host role, so no anonymous participant
    // receives administrative room permissions.
    roomAdmin: false,
  });

  return at.toJwt();
}

/**
 * Room service client for server-side operations.
 * Instantiated on demand to avoid breaking startup if the URL changes.
 */
export function getRoomService(): RoomServiceClient {
  return new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

/** Returns whether a LiveKit room currently has connected participants. */
export async function hasConnectedParticipants(
  roomCode: string,
): Promise<boolean | null> {
  try {
    const rooms = await getRoomService().listRooms([roomCode]);
    return (rooms[0]?.numParticipants ?? 0) > 0;
  } catch (err) {
    // Unknown service state must not cause an occupied room to be deleted.
    console.warn(`[livekit] could not inspect room ${roomCode}:`, err);
    return null;
  }
}

/** Closes a LiveKit room (clears participants/tracks). */
export async function closeLiveKitRoom(roomCode: string): Promise<void> {
  try {
    const svc = getRoomService();
    await svc.deleteRoom(roomCode);
  } catch (err) {
    // Cleanup commonly races with LiveKit's own empty-room removal.
    if (
      typeof err === "object" &&
      err !== null &&
      (("code" in err && err.code === "not_found") ||
        ("status" in err && err.status === 404))
    ) {
      return;
    }
    console.warn(`[livekit] room ${roomCode} could not be closed:`, err);
  }
}
