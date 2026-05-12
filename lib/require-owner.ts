import { getSession } from "@/lib/require-session";

/** Landlord dashboard session (formerly Owner). */
export async function requireLandlord() {
  const session = await getSession();
  if (!session || session.role !== "Landlord") return null;
  return session;
}

/** @deprecated Use requireLandlord */
export const requireOwner = requireLandlord;
