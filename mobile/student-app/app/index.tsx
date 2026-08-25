import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { homeHrefForRole } from "@/lib/auth-routes";

export default function Index() {
  const { user } = useAuth();

  if (!user) return <Redirect href="/login" />;

  const home = homeHrefForRole(user.role);
  if (home) return <Redirect href={home} />;
  return <Redirect href="/login" />;
}
