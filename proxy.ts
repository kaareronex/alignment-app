import { NextRequest, NextResponse } from "next/server";
import { decryptAdminSession } from "@/lib/admin-session";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const session = await decryptAdminSession(
    req.cookies.get("admin_session")?.value
  );
  const isAuthenticated = Boolean(session);

  if (pathname === "/admin/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/admin", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
