import "server-only";
import { NextResponse } from "next/server";

export const PRIVATE_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";

/**
 * Attaches explicit anti-caching HTTP headers for private, user-specific or sensitive API responses.
 * Prevents intermediate reverse proxies, CDNs, and browser caches from storing or cross-serving private data.
 */
export function withPrivateCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  response.headers.set("Pragma", "no-cache");
  return response;
}

/**
 * Creates a JSON response with strict private anti-caching headers attached.
 */
export function jsonPrivate<T>(body: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  return withPrivateCacheHeaders(response);
}
