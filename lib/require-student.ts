import { getSession } from "@/lib/require-session";

export async function requireStudent() {
  const session = await getSession();
  if (!session || session.role !== "Student") return null;
  return session;
}
