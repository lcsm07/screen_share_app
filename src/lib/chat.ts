/**
 * Registers a chat message ID once.
 *
 * This must run before React's state updater. Updaters may be evaluated more
 * than once in Strict Mode, so mutating the seen-ID set inside one can make a
 * valid message disappear on the second evaluation.
 */
export function registerMessageId(seenIds: Set<string>, id: string): boolean {
  if (seenIds.has(id)) return false;
  seenIds.add(id);
  return true;
}

/** Chat is useful only when there is someone else in the room. */
export function canUseChat(participantCount: number): boolean {
  return participantCount >= 2;
}
