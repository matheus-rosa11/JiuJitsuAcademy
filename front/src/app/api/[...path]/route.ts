import { NextResponse, type NextRequest } from "next/server";

const SESSION = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 60;

function apiBase() {
  return (process.env.API_URL ?? "http://localhost:5106").replace(/\/$/, "");
}

function sessionCookie(token: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token ? SESSION_MAX_AGE : 0,
  };
}

async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path[0] === "auth" && path[1] === "logout" && request.method === "POST") {
    const done = NextResponse.json({ ok: true });
    done.cookies.set(SESSION, "", sessionCookie(""));
    return done;
  }

  const target = `${apiBase()}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const token = request.cookies.get(SESSION)?.value;

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: {
        accept: "application/json",
        ...(hasBody ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });

    const opensSession = response.ok && path[0] === "auth" && (path[1] === "login" || path[1] === "register");
    if (opensSession) {
      const data = (await response.json()) as { token?: string };
      const issued = data.token ?? "";
      delete data.token;
      const next = NextResponse.json(data);
      if (issued) next.cookies.set(SESSION, issued, sessionCookie(issued));
      return next;
    }

    return new NextResponse(response.status === 204 ? null : await response.arrayBuffer(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ message: "Não foi possível conectar à API." }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
