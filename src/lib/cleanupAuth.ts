/** Validates Vercel Cron requests and legacy manual cleanup requests. */
export function isCleanupRequestAuthorized(
  request: Request,
  secret: string,
): boolean {
  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-cleanup-key") === secret
  );
}
