import { NextResponse, type NextRequest } from "next/server";
import { readActor } from "../../session";

async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const actor = await readActor(request);
  if (!actor) return NextResponse.json({ message: "Entre na sua conta para continuar." }, { status: 401 });

  const head = path[0];
  const adminOnly = head === "attendance" || head === "recognize" || head === "demo";
  if (adminOnly && actor.role !== "Admin") {
    return NextResponse.json({ message: "Você não tem acesso a isto." }, { status: 403 });
  }
  if (request.nextUrl.searchParams.get("embeddings") === "true" && actor.role !== "Admin") {
    return NextResponse.json({ message: "Você não tem acesso a isto." }, { status: 403 });
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;
  if (actor.role === "Student") {
    const own = actor.studentId;
    if (head === "enroll") {
      let studentId = "";
      try {
        studentId = (JSON.parse(body ?? "{}") as { studentId?: string }).studentId ?? "";
      } catch {
        studentId = "";
      }
      if (!own || studentId !== own) return NextResponse.json({ message: "Você não tem acesso a isto." }, { status: 403 });
    }
    if ((request.method === "DELETE" || request.method === "GET") && path.length === 1 && path[0] !== own) {
      return NextResponse.json({ message: "Você não tem acesso a isto." }, { status: 403 });
    }
  }

  const base = (process.env.FACE_SERVICE_URL ?? "http://127.0.0.1:5110").replace(/\/$/, "");
  const target = `${base}/faces/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  try {
    const response = await fetch(target, {
      method: request.method,
      headers: {
        accept: "application/json",
        ...(hasBody ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
      },
      body,
      cache: "no-store",
    });
    return new NextResponse(response.status === 204 ? null : await response.arrayBuffer(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ message: "Cadastro facial indisponível no momento.", code: "unavailable" }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as DELETE };
