export const SESSION_COOKIE = "dc_session";

export const DB_ROLE_TO_ROUTE: Record<string, string> = {
  "ICT Admin": "/admin",
  "OSA Admin": "/osa",
  Owner: "/landlord",
  Student: "/student",
};

export function pathRequiresRole(pathname: string): string | null {
  if (pathname.startsWith("/admin")) return "ICT Admin";
  if (pathname.startsWith("/osa")) return "OSA Admin";
  if (pathname.startsWith("/landlord")) return "Owner";
  if (pathname.startsWith("/student")) return "Student";
  return null;
}
