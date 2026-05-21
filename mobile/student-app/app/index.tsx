import { Redirect } from "expo-router";
import { CenteredLoader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { homeHrefForRole } from "@/lib/auth-routes";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) return <CenteredLoader />;
  if (!user) return <Redirect href="/login" />;

  const home = homeHrefForRole(user.role);
  if (home) return <Redirect href={home} />;
  return <Redirect href="/login" />;
}
