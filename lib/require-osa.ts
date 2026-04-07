import { getSession } from "@/lib/require-session";

export async function requireOsaAdmin() {
  const session = await getSession();
  if (!session || session.role !== "OSA Admin") return null;
  return session;
}
