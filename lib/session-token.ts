import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { getJwtSecretKey } from "./jwt-secret";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
};

function requireSecret(): Uint8Array {
  const k = getJwtSecretKey();
  if (!k) {
    throw new Error("AUTH_SECRET must be set (min 16 characters)");
  }
  return k;
}

export async function signSessionToken(
  p: SessionPayload,
  maxAgeSec = 60 * 60 * 24 * 7
): Promise<string> {
  return new SignJWT({
    email: p.email,
    name: p.name,
    role: p.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(requireSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  const key = getJwtSecretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    const sub = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const role = payload.role;
    if (
      typeof sub !== "string" ||
      typeof email !== "string" ||
      typeof name !== "string" ||
      typeof role !== "string"
    ) {
      return null;
    }
    return { sub, email, name, role };
  } catch {
    return null;
  }
}
