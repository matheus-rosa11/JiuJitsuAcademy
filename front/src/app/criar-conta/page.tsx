import Link from "next/link";
import { StudentForm } from "@/components/StudentForm";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Criar conta</h1>
      <p className="mt-1 mb-6 max-w-xl text-sm text-zinc-500">
        Preencha sua ficha e, em seguida, cadastre o rosto. Marque a turma em que a foto do treino será feita.
      </p>
      <StudentForm selfService />
      <p className="mt-4 text-sm text-zinc-500">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
