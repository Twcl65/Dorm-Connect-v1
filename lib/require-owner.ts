import { getSession } from "@/lib/require-session";

export async function requireOwner() {
  const session = await getSession();
  if (!session || session.role !== "Owner") return null;
  return session;
}
