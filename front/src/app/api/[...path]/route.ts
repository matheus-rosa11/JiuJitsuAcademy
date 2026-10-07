import type { NextRequest } from "next/server";

// Forwards /api/* to the ASP.NET API. API_URL is read at runtime, so the same image works in any
// environment (on Railway: http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}).
// This is also where auth headers/tokens will be attached once Google login is added.
async function forward(request: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  const apiUrl = (process.env.API_URL ?? "http://localhost:5106").replace(/\/$/, "");
  const target = `${apiUrl}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: {
        accept: "application/json",
        ...(hasBody ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
      },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });

    return new Response(response.status === 204 ? null : await response.arrayBuffer(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ message: "Não foi possível conectar à API." }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
