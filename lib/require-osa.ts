import { getSession } from "@/lib/require-session";

export async function requireOsaAdmin() {
  const session = await getSession();
  if (!session || session.role !== "OSA/SAS Admin") return null;
  return session;
}
