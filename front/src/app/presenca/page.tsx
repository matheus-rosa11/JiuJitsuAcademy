"use client";

import { CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, CircleCheck, Info, RotateCcw, Search, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BeltBadge, BeltLabel } from "@/components/BeltBadge";
import { useToast } from "@/components/Toast";
import { Avatar, Badge, Button, buttonClass, Card, cn, EmptyState, ErrorState, Input, PageHeader, ProgressBar, Segmented, Select, Spinner, rateTone } from "@/components/ui";
import { api, type AttendanceSheet, type StudentFrequency, type TrainingClass } from "@/lib/api";
import { addDays, formatDate, formatDays, todayIso, WEEKDAYS, WEEKDAYS_FULL, weekdayOf } from "@/lib/format";
import { useApi } from "@/lib/useApi";

function RollCall({ classes, initialClassId }: { classes: TrainingClass[]; initialClassId: string | null }) {
  const toast = useToast();
  const active = classes.filter((c) => c.active);
  const todayWeekday = new Date().getDay();
  const defaultClass =
    active.find((c) => c.id === initialClassId) ?? active.find((c) => c.daysOfWeek.includes(todayWeekday)) ?? active[0];

  const [classId, setClassId] = useState(defaultClass?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const sheetPath = classId ? `/attendance/sheet?classId=${classId}&date=${date}` : null;
  const { data: sheet, error, reload } = useApi<AttendanceSheet>(sheetPath);
  const [marks, setMarks] = useState<{ key: string; values: Record<string, boolean> }>();

  const currentSheet = sheet && sheet.classId === classId && sheet.date === date ? sheet : undefined;
  const changes = marks?.key === sheetPath ? marks.values : {};
  const isPresent = (s: AttendanceSheet["students"][number]) => changes[s.studentId] ?? s.present;
  const dirty = currentSheet?.students.some((s) => s.studentId in changes && changes[s.studentId] !== s.present) ?? false;
  const presentCount = currentSheet?.students.filter(isPresent).length ?? 0;
  const selectedClass = classes.find((c) => c.id === classId);
  const meetsToday = selectedClass?.daysOfWeek.includes(weekdayOf(date));

  function setPresence(values: Record<string, boolean>) {
    setMarks({ key: sheetPath!, values: { ...changes, ...values } });
  }

  function confirmLeave() {
    return !dirty || confirm("Há alterações não salvas na chamada. Descartar?");
  }

  async function save() {
    if (!currentSheet) return;
    setSaving(true);
    try {
      await api("/attendance", {
        method: "POST",
        body: { classId, date, items: currentSheet.students.map((s) => ({ studentId: s.studentId, present: isPresent(s) })) },
      });
      toast(`Presença salva: ${presentCount} de ${currentSheet.students.length} alunos.`);
      setMarks(undefined);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (active.length === 0) {
    return (
      <Card>
        <EmptyState icon={<CalendarCheck className="size-6" />} title="Nenhuma turma ativa" description="Crie uma turma para começar a registrar presença." action={<Link href="/turmas" className={buttonClass()}>Ir para turmas</Link>} />
      </Card>
    );
  }

  const term = search.trim().toLowerCase();
  const visible = currentSheet?.students.filter((s) => s.name.toLowerCase().includes(term)) ?? [];

  return (
    <div className="space-y-4">
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {active.map((c) => {
          const today = c.daysOfWeek.includes(todayWeekday);
          return (
            <button
              key={c.id}
              onClick={() => confirmLeave() && setClassId(c.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-4 py-3 text-left ring-1 transition-all",
                c.id === classId ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-200 hover:ring-zinc-400",
              )}
            >
              {today && <span className="size-2 rounded-full bg-emerald-400" title="Tem aula hoje" />}
              <div>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className={cn("text-xs", c.id === classId ? "text-zinc-400" : "text-zinc-500")}>
                  {formatDays(c.daysOfWeek)} · {c.startTime}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="flex items-center gap-2 p-2">
        <Button variant="ghost" size="sm" onClick={() => confirmLeave() && setDate(addDays(date, -1))} aria-label="Dia anterior">
          <ChevronLeft className="size-5" />
        </Button>
        <label className="relative flex flex-1 cursor-pointer items-center justify-center gap-2 text-center">
          <span className="font-semibold text-zinc-900">
            {WEEKDAYS_FULL[weekdayOf(date)]}, {formatDate(date)}
          </span>
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => e.target.value && confirmLeave() && setDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        {date !== todayIso() && (
          <Button variant="secondary" size="sm" onClick={() => confirmLeave() && setDate(todayIso())}>
            Hoje
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => confirmLeave() && setDate(addDays(date, 1))} disabled={date >= todayIso()} aria-label="Próximo dia">
          <ChevronRight className="size-5" />
        </Button>
      </Card>

      {selectedClass && !meetsToday && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="size-4 shrink-0" />
          {selectedClass.name} não tem aula às {WEEKDAYS[weekdayOf(date)].toLowerCase()}s. Você ainda pode registrar a presença (ex.: aula extra).
        </p>
      )}

      {error && !currentSheet ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !currentSheet ? (
        <Spinner />
      ) : currentSheet.students.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-6" />} title="Nenhum aluno nesta turma" description="Matricule alunos na turma pelo cadastro do aluno." />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <p className="text-lg font-semibold text-zinc-900">
                {presentCount} <span className="font-normal text-zinc-500">de {currentSheet.students.length} presentes</span>
              </p>
            </div>
            {currentSheet.saved && !dirty && (
              <Badge tone="green">
                <CircleCheck className="size-3.5" /> Chamada salva
              </Badge>
            )}
            {dirty && <Badge tone="amber">Alterações não salvas</Badge>}
            <Button variant="secondary" size="sm" onClick={() => setPresence(Object.fromEntries(currentSheet.students.map((s) => [s.studentId, true])))}>
              <CheckCheck className="size-4" /> Todos presentes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPresence(Object.fromEntries(currentSheet.students.map((s) => [s.studentId, false])))}>
              <RotateCcw className="size-4" /> Limpar
            </Button>
          </div>

          {currentSheet.students.length > 10 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input className="pl-10" placeholder="Filtrar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}

          <ul className="grid gap-2 sm:grid-cols-2">
            {visible.map((s) => {
              const present = isPresent(s);
              return (
                <li key={s.studentId}>
                  <button
                    onClick={() => setPresence({ [s.studentId]: !present })}
                    className={cn(
                      "flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition-all active:scale-[0.99]",
                      present ? "bg-emerald-50 ring-2 ring-emerald-500" : "bg-white ring-zinc-200 hover:ring-zinc-300",
                    )}
                  >
                    <Avatar name={s.name} tone={s.studentType === "Child" ? "sky" : "zinc"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900">{s.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <BeltBadge name={s.beltName} degree={s.degree} size="sm" />
                        <span className="text-xs text-zinc-500">{s.beltName}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full transition-all",
                        present ? "bg-emerald-500 text-white" : "ring-2 ring-zinc-200",
                      )}
                    >
                      {present && <CheckCheck className="size-4" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-20 z-20 lg:bottom-4">
            <Button size="lg" variant="success" className="w-full shadow-lg" onClick={save} loading={saving} disabled={!dirty && currentSheet.saved}>
              <CalendarCheck className="size-5" />
              {currentSheet.saved && !dirty ? "Presença salva" : `Salvar presença (${presentCount}/${currentSheet.students.length})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Frequency({ classes }: { classes: TrainingClass[] }) {
  const [days, setDays] = useState<"30" | "60" | "90">("30");
  const [classId, setClassId] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const { data, error, reload } = useApi<StudentFrequency[]>(`/attendance/frequency?days=${days}${classId ? `&classId=${classId}` : ""}`);

  const rows = (data ?? []).filter((r) => !onlyLow || (r.sessions > 0 && r.rate < 60));

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <Segmented
          value={days}
          onChange={setDays}
          options={[
            { value: "30", label: "30 dias" },
            { value: "60", label: "60 dias" },
            { value: "90", label: "90 dias" },
          ]}
        />
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="sm:w-56">
          <option value="">Todas as turmas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 px-1 text-sm text-zinc-700">
          <input type="checkbox" className="size-4 accent-zinc-900" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Somente abaixo de 60%
        </label>
      </Card>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Spinner />
      ) : (
        <Card>
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.studentId}>
                <Link href={`/alunos/${r.studentId}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-zinc-50 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_100px_minmax(0,1fr)_110px] sm:px-5">
                  <p className="truncate font-medium text-zinc-900">{r.name}</p>
                  <div className="hidden sm:block">
                    <BeltLabel name={r.beltName} degree={r.degree} size="sm" />
                  </div>
                  <span className="text-right text-sm text-zinc-500 sm:text-left">
                    {r.presences}/{r.sessions} aulas
                  </span>
                  <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                    <ProgressBar value={r.rate} tone={r.sessions === 0 ? "zinc" : rateTone(r.rate)} />
                    <span className={cn("w-11 text-right text-sm font-semibold tabular-nums", r.sessions > 0 && r.rate < 60 ? "text-red-600" : "text-zinc-900")}>
                      {r.sessions === 0 ? "—" : `${r.rate.toFixed(0)}%`}
                    </span>
                  </div>
                  <span className="hidden text-xs text-zinc-500 sm:block">{r.lastPresence ? `Último: ${formatDate(r.lastPresence)}` : "Sem presença"}</span>
                </Link>
              </li>
            ))}
            {rows.length === 0 && <li className="px-5 py-10 text-center text-sm text-zinc-500">Nenhum aluno para os filtros selecionados.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AttendancePage() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"chamada" | "frequencia">(params.get("tab") === "frequencia" ? "frequencia" : "chamada");
  const { data: classes, error, reload } = useApi<TrainingClass[]>("/classes");

  return (
    <>
      <PageHeader
        title="Presença"
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "chamada", label: "Chamada" },
              { value: "frequencia", label: "Frequência" },
            ]}
          />
        }
      />
      {error && !classes ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !classes ? (
        <Spinner />
      ) : tab === "chamada" ? (
        <RollCall classes={classes} initialClassId={params.get("turma")} />
      ) : (
        <Frequency classes={classes} />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <AttendancePage />
    </Suspense>
  );
}
