"use client";

import { ChevronRight, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BeltLabel } from "@/components/BeltBadge";
import { Avatar, Badge, buttonClass, Card, EmptyState, ErrorState, Input, PageHeader, Segmented, Select, Spinner } from "@/components/ui";
import type { Belt, StudentListItem, StudentType } from "@/lib/api";
import { formatCurrency, studentTypeLabel } from "@/lib/format";
import { useApi } from "@/lib/useApi";

type TypeFilter = "all" | StudentType;
type StatusFilter = "true" | "false" | "all";

function StudentsPage() {
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("true");
  const [beltId, setBeltId] = useState(params.get("belt") ?? "");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: belts } = useApi<Belt[]>("/belts");

  const query = new URLSearchParams();
  if (debounced) query.set("search", debounced);
  if (type !== "all") query.set("type", type);
  if (status !== "all") query.set("active", status);
  if (beltId) query.set("beltId", beltId);
  const { data: students, error, reload, loading } = useApi<StudentListItem[]>(`/students?${query}`);

  const beltGroups = (["Adult", "Child"] as const)
    .filter((c) => type === "all" || type === c)
    .map((c) => ({ category: c, belts: (belts ?? []).filter((b) => b.category === c) }));

  function changeType(next: TypeFilter) {
    setType(next);
    const belt = belts?.find((b) => b.id === beltId);
    if (belt && next !== "all" && belt.category !== next) setBeltId("");
  }

  return (
    <>
      <PageHeader
        title="Alunos"
        description={students ? `${students.length} ${students.length === 1 ? "aluno" : "alunos"}` : " "}
        actions={
          <Link href="/alunos/novo" className={buttonClass()}>
            <Plus className="size-4" />
            Novo aluno
          </Link>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input className="pl-10" placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Segmented
              value={type}
              onChange={changeType}
              options={[
                { value: "all", label: "Todos" },
                { value: "Adult", label: "Adultos" },
                { value: "Child", label: "Infantis" },
              ]}
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="sm:w-36">
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
              <option value="all">Todos</option>
            </Select>
            <Select value={beltId} onChange={(e) => setBeltId(e.target.value)} className="sm:w-48">
              <option value="">Todas as faixas</option>
              {beltGroups.map((g) => (
                <optgroup key={g.category} label={g.category === "Adult" ? "Adulto" : "Infantil"}>
                  {g.belts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {error && !students ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !students ? (
        <Spinner />
      ) : students.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-6" />} title="Nenhum aluno encontrado" description="Ajuste os filtros ou cadastre um novo aluno." />
        </Card>
      ) : (
        <Card className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="hidden grid-cols-[minmax(0,2fr)_110px_minmax(0,1.4fr)_120px_90px_20px] gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400 md:grid">
            <span>Aluno</span>
            <span>Tipo</span>
            <span>Faixa</span>
            <span>Mensalidade</span>
            <span>Situação</span>
            <span />
          </div>
          <ul className="divide-y divide-zinc-100">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/alunos/${s.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-zinc-50 md:grid-cols-[minmax(0,2fr)_110px_minmax(0,1.4fr)_120px_90px_20px] md:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={s.name} tone={s.studentType === "Child" ? "sky" : "zinc"} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900">{s.name}</p>
                      <p className="text-xs text-zinc-500">{s.age} anos</p>
                    </div>
                  </div>
                  <div className="md:order-none">
                    <Badge tone={s.studentType === "Child" ? "blue" : "zinc"}>{studentTypeLabel(s.studentType)}</Badge>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <BeltLabel name={s.beltName} degree={s.currentDegree} />
                  </div>
                  <span className="hidden text-sm tabular-nums text-zinc-700 md:block">{formatCurrency(s.monthlyFee)}</span>
                  <span className="hidden md:block">{s.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</span>
                  <ChevronRight className="hidden size-4 text-zinc-300 md:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <StudentsPage />
    </Suspense>
  );
}
