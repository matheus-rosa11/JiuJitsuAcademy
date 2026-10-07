"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StudentForm } from "@/components/StudentForm";
import { ErrorState, PageHeader, Spinner } from "@/components/ui";
import type { StudentDetail } from "@/lib/api";
import { useApi } from "@/lib/useApi";

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: student, error, reload } = useApi<StudentDetail>(`/students/${id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/alunos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <PageHeader title="Editar aluno" description={student?.name} />
      {error && !student ? <ErrorState message={error} onRetry={reload} /> : !student ? <Spinner /> : <StudentForm initial={student} />}
    </div>
  );
}
