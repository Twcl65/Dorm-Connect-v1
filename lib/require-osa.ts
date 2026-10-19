import { getSession } from "@/lib/require-session";

export async function requireOsaAdmin() {
  const session = await getSession();
  if (!session || session.role !== "OSA/SAS Admin") return null;
  return session;
}

export async function requireOsaStaff() {
  const session = await getSession();
  if (!session || !["OSA/SAS Admin", "Staff"].includes(session.role)) return null;
  return session;
}
