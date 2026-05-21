import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";
import { pathRequiresRole, SESSION_COOKIE } from "@/lib/auth-config";
import { applyCorsHeaders, getCorsHeaders } from "@/lib/cors";
import { getJwtSecretKey } from "@/lib/jwt-secret";

async function sessionFromCookie(token: string) {
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

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }
    const res = NextResponse.next();
    applyCorsHeaders(res.headers, request);
    return res;
  }

  const requiredRole = pathRequiresRole(pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await sessionFromCookie(token) : null;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session.role !== requiredRole) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/* Admin UI is not matched here so the first ICT admin can open User Management when the
   table is still empty (middleware cannot query Postgres on the Edge runtime). Admin APIs
   enforce ICT Admin session whenever at least one user exists. */
export const config = {
  matcher: ["/api/:path*", "/osa/:path*", "/landlord/:path*", "/student/:path*"],
};
