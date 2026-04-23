import type { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { signSessionToken, type SessionPayload } from "@/lib/session-token";

export async function setSessionCookieOnResponse(
  res: NextResponse,
  payload: SessionPayload
): Promise<void> {
  const token = await signSessionToken(payload);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
