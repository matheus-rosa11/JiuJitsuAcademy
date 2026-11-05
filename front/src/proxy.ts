import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = new Set(["/entrar", "/criar-conta"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api")) return NextResponse.next();
  const signedIn = Boolean(request.cookies.get("session")?.value);
  if (!signedIn && !PUBLIC.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && PUBLIC.has(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
