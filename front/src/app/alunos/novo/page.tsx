import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StudentForm } from "@/components/StudentForm";
import { PageHeader } from "@/components/ui";

export default function NewStudentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/alunos" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> Alunos
      </Link>
      <PageHeader title="Novo aluno" />
      <StudentForm />
    </div>
  );
}
