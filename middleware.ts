import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PAGE_PREFIXES = ["/admin", "/coach", "/client", "/profile"] as const;
const PROTECTED_API_PREFIXES = ["/api/sessions"] as const;

const ROLE_ALLOWED_PREFIXES: Record<string, readonly string[]> = {
  admin: ["/admin"],
  coach: ["/coach"],
  client: ["/client"],
};

export default auth((request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const session = request.auth;

  if (!session?.user?.id) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const sessionUser = session.user as typeof session.user & {
    role?: unknown;
    app_metadata?: { role?: unknown };
  };

  if (!isAuthorized(sessionUser.role ?? sessionUser.app_metadata?.role, pathname)) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/coach/:path*",
    "/client/:path*",
    "/profile/:path*",
    "/api/sessions/:path*",
  ],
};

function isProtectedPath(pathname: string) {
  return [...PROTECTED_PAGE_PREFIXES, ...PROTECTED_API_PREFIXES].some((prefix) => pathname.startsWith(prefix));
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/");
}

function isAuthorized(rawRole: unknown, pathname: string) {
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/coach") && !pathname.startsWith("/client")) {
    return true;
  }

  if (rawRole !== "admin" && rawRole !== "coach" && rawRole !== "client") {
    return false;
  }

  return ROLE_ALLOWED_PREFIXES[rawRole].some((prefix) => pathname.startsWith(prefix));
}
