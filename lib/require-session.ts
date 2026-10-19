import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { verifySessionToken, type SessionPayload } from "@/lib/session-token";

async function sessionFromBearerHeader(): Promise<SessionPayload | null> {
  const auth = headers().get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSession(): Promise<SessionPayload | null> {
  const bearer = await sessionFromBearerHeader();
  if (bearer) return bearer;

  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireIctAdmin(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || session.role !== "ICT Admin") return null;
  return session;
}
