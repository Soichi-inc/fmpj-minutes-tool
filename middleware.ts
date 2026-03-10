import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page and API routes
  if (pathname === "/" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check auth cookie with signature verification
  const authCookie = request.cookies.get(COOKIE_NAME);
  const secret = process.env.APP_PASSWORD;

  if (
    !authCookie ||
    !secret ||
    !verifySessionToken(authCookie.value, secret)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
