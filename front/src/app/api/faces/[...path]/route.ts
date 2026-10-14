import type { NextRequest } from "next/server";

// More specific than /api/[...path], so face calls never reach the .NET API.
async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const base = (process.env.FACE_SERVICE_URL ?? "http://127.0.0.1:5110").replace(/\/$/, "");
  const target = `${base}/faces/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
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
    return Response.json({ message: "Cadastro facial indisponível no momento.", code: "unavailable" }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as DELETE };
