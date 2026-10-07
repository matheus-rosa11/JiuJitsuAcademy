"use client";

import { Award, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BeltBadge } from "@/components/BeltBadge";
import { GraduationModal, type GraduationTarget } from "@/components/GraduationModal";
import { StudentPicker } from "@/components/StudentPicker";
import { Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Segmented, Spinner } from "@/components/ui";
import type { Graduation } from "@/lib/api";
import { formatDateShort, studentTypeLabel } from "@/lib/format";
import { useApi } from "@/lib/useApi";

export default function GraduationsPage() {
  const { data, error, reload } = useApi<Graduation[]>("/graduations/recent?take=60");
  const [filter, setFilter] = useState<"all" | "Belt" | "Degree">("all");
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<GraduationTarget | null>(null);

  const items = (data ?? []).filter((g) => g.changeType !== "Initial" && (filter === "all" || g.changeType === filter));

  return (
    <>
      <PageHeader
        title="Graduações"
        description="Trocas de faixa e de grau mais recentes da academia."
        actions={
          <Button onClick={() => setPicking(true)}>
            <Plus className="size-4" />
            Registrar graduação
          </Button>
        }
      />

      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Todas" },
          { value: "Belt", label: "Novas faixas" },
          { value: "Degree", label: "Graus" },
        ]}
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<Award className="size-6" />} title="Nenhuma graduação registrada" />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-zinc-100">
            {items.map((g) => (
              <li key={g.id}>
                <Link href={`/alunos/${g.studentId}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-50 sm:px-5">
                  <div className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">{formatDateShort(g.date)}</div>
                  <BeltBadge name={g.beltName} degree={g.degree} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">{g.studentName}</p>
                    <p className="text-sm text-zinc-500">
                      {g.changeType === "Belt" ? `Faixa ${g.beltName}` : `${g.beltName} · ${g.degree}º grau`}
                      <span className="hidden sm:inline"> · {studentTypeLabel(g.beltCategory)}</span>
                    </p>
                  </div>
                  {g.changeType === "Belt" ? <Badge tone="violet">Nova faixa</Badge> : <Badge>Grau</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={picking} onClose={() => setPicking(false)} title="Escolha o aluno">
        <StudentPicker
          onPick={(s) => {
            setPicking(false);
            setTarget(s);
          }}
        />
      </Modal>

      {target && (
        <GraduationModal
          student={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            reload();
          }}
        />
      )}
    </>
  );
}
