"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/Session";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { email, password } });
      refresh();
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <Card className="w-full p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Entrar</h1>
        <p className="mt-1 text-sm text-zinc-500">Use o e-mail e a senha da sua conta.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="E-mail">
            <Input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Senha">
            <Input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">
            Entrar
          </Button>
        </form>
        <p className="mt-4 text-sm text-zinc-500">
          Ainda não tem conta?{" "}
          <Link href="/criar-conta" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
            Criar conta
          </Link>
        </p>
      </Card>
    </div>
  );
}
