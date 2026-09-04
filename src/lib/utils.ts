import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with clsx. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Creates a unique identifier in browsers that do not expose crypto.randomUUID.
 * The fallback is only used for identifiers, never for authentication secrets.
 */
export function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    try {
      const values = new Uint32Array(4);
      cryptoApi.getRandomValues(values);
      return Array.from(values, (value) => value.toString(36).padStart(7, "0")).join("-");
    } catch {
      // Fall through to the non-cryptographic identifier fallback.
    }
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Generates a friendly room code (uppercase + numbers, without ambiguous chars). */
export function generateRoomCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
  let out = "";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Normalizes and validates room codes accepted by public routes. */
export function normalizeRoomCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{4,12}$/.test(code) ? code : null;
}

/** Formats a simple relative time. */
export function timeAgo(date: number | string | Date): string {
  const d = typeof date === "number" ? new Date(date) : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "now";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}
