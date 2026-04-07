import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { verifySessionToken, type SessionPayload } from "@/lib/session-token";

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireIctAdmin(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || session.role !== "ICT Admin") return null;
  return session;
}
