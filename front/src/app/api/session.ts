import type { NextRequest } from "next/server";

export interface Actor {
  userId: string;
  email: string;
  role: "Admin" | "Student";
  studentId: string | null;
  name: string;
}

export async function readActor(request: NextRequest): Promise<Actor | null> {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;
  const apiUrl = (process.env.API_URL ?? "http://localhost:5106").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as Actor;
  } catch {
    return null;
  }
}
