import { uuidv7 } from 'uuidv7';

/**
 * Generates a UUIDv7 — time-ordered, index-friendly, and safe to create offline
 * (a sale recorded without connectivity needs a real id before it reaches the server).
 * This is the only way ids are created anywhere in the app. See ARCHITECTURE.md §6.2.
 */
export function generateId(): string {
  return uuidv7();
}
