/** Chat message transported via LiveKit data channel. */
export interface ChatMessage {
  id: string;
  participantIdentity: string;
  nickname: string;
  text: string;
  ts: number;
  isSystem?: boolean;
}

/** LiveKit token API response. */
export interface TokenResponse {
  token: string;
  url: string;
  roomCode: string;
}

/** Room creation API response. */
export interface RoomResponse {
  code: string;
  url: string;
  createdAt: string;
}

/** Room validation API response. */
export interface RoomInfo {
  code: string;
  name: string | null;
  active: boolean;
  createdAt: string;
}

/** Standard API error. */
export interface ApiError {
  error: string;
}
