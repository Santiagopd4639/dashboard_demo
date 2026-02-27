import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth";

const PUBLIC_API_PATHS = new Set(["/api/auth/login", "/api/auth/logout"]);

function isProtectedApi(pathname: string) {
  return pathname.startsWith("/api") && !PUBLIC_API_PATHS.has(pathname);
}

function isProtectedDashboard(pathname: string) {
  return pathname.startsWith("/dashboard");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedApi(pathname) && !isProtectedDashboard(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const valid = await verifySession(token);
  if (!valid) {
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
