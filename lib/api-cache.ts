import { NextResponse } from "next/server";

type CacheEntry = { data: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();

/** Default TTL for per-user dashboard/list reads. */
export const API_CACHE_TTL_MS = 45_000;

/** Longer TTL for public browse data. */
export const PUBLIC_CACHE_TTL_MS = 5 * 60_000;

export function cacheKey(parts: (string | boolean | number | null | undefined)[]): string {
  return parts
    .map((p) => (p === null || p === undefined || p === "" ? "_" : String(p)))
    .join(":");
}

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached(key: string, data: unknown, ttlMs = API_CACHE_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function invalidateLandlordUser(userId: string): void {
  invalidateCachePrefix(`landlord:${userId}:`);
}

export function invalidateStudentUser(userId: string): void {
  invalidateCachePrefix(`student:${userId}:`);
}

export function invalidateOsaUser(userId: string): void {
  invalidateCachePrefix(`osa:${userId}:`);
}

export function invalidatePublicProperties(): void {
  invalidateCachePrefix("public:");
}

export function invalidateAdminStats(): void {
  store.delete("admin:stats");
}

export async function cachedJsonResponse<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<NextResponse> {
  const hit = getCached<T>(key);
  if (hit !== null) {
    return NextResponse.json(hit, { headers: { "X-Cache": "HIT" } });
  }
  const data = await loader();
  setCached(key, data, ttlMs);
  return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });
}
