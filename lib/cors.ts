import type { NextRequest } from "next/server";

const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";

/** CORS headers for Dorm Connect mobile clients (Expo). */
export function getCorsHeaders(request?: NextRequest): HeadersInit {
  const origin = request?.headers.get("origin") ?? "";
  const allowOrigin =
    process.env.MOBILE_CORS_ORIGIN?.trim() ||
    (origin && !origin.includes("null") ? origin : "*");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

export function applyCorsHeaders(
  headers: Headers,
  request?: NextRequest
): void {
  const cors = getCorsHeaders(request);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
}
