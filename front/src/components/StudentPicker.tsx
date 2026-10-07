"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { StudentListItem } from "@/lib/api";
import { studentTypeLabel } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { BeltBadge } from "./BeltBadge";
import { Avatar, Input, Spinner } from "./ui";

export function StudentPicker({ onPick }: { onPick: (student: StudentListItem) => void }) {
  const { data: students } = useApi<StudentListItem[]>("/students?active=true");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (students ?? []).filter((s) => s.name.toLowerCase().includes(term));
  }, [students, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <Input autoFocus className="pl-10" placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {!students ? (
        <Spinner />
      ) : (
        <ul className="max-h-[50dvh] divide-y divide-zinc-100 overflow-y-auto rounded-xl ring-1 ring-zinc-200">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50"
              >
                <Avatar name={s.name} size="sm" tone={s.studentType === "Child" ? "sky" : "zinc"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{s.name}</p>
                  <p className="text-xs text-zinc-500">{studentTypeLabel(s.studentType)}</p>
                </div>
                <BeltBadge name={s.beltName} degree={s.currentDegree} size="sm" />
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-500">Nenhum aluno encontrado.</li>}
        </ul>
      )}
    </div>
  );
}
