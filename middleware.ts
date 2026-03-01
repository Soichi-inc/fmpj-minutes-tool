import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page and API routes
  if (pathname === "/" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check auth cookie
  const authCookie = request.cookies.get("fmpj-auth");
  if (!authCookie || authCookie.value !== "authenticated") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
