"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FaceEnrollment } from "@/components/FaceEnrollment";
import { Spinner } from "@/components/ui";
import type { StudentDetail } from "@/lib/api";
import { useApi } from "@/lib/useApi";

export default function FaceEnrollmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: student, error } = useApi<StudentDetail>(`/students/${id}`);

  if (error && !student) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!student) return <Spinner />;

  return (
    <div className="mx-auto max-w-md">
      <Link href={`/alunos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> {student.name}
      </Link>
      <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight">Cadastrar meu rosto</h1>
      <p className="mb-6 text-center text-sm text-zinc-500">Leva menos de um minuto. Siga as instruções na tela.</p>
      <FaceEnrollment
        studentId={id}
        source="camera"
        autoContinue
        onContinue={() => router.push(`/alunos/${id}`)}
        onSkip={() => router.push(`/alunos/${id}`)}
      />
      {process.env.NODE_ENV === "development" && (
        <p className="mt-6 text-center text-xs text-zinc-400">
          <Link href="/demo/facial" className="underline">
            Abrir a tela técnica
          </Link>
        </p>
      )}
    </div>
  );
}
