"use client";

import { CalendarCheck, Clock, Pencil, Plus, School, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { Badge, Button, buttonClass, Card, cn, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Segmented, Spinner, Textarea } from "@/components/ui";
import { api, type ClassRequest, type StudentType, type TrainingClass } from "@/lib/api";
import { WEEKDAYS } from "@/lib/format";
import { useApi } from "@/lib/useApi";

function ClassModal({ initial, onClose, onSaved }: { initial?: TrainingClass; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<ClassRequest>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    daysOfWeek: initial?.daysOfWeek ?? [1, 3, 5],
    startTime: initial?.startTime ?? "19:00",
    endTime: initial?.endTime ?? "20:30",
    active: initial?.active ?? true,
    targetStudentType: initial?.targetStudentType ?? null,
  });
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: number) =>
    setForm((f) => ({ ...f, daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day] }));

  async function save() {
    setSaving(true);
    try {
      await api(initial ? `/classes/${initial.id}` : "/classes", { method: initial ? "PUT" : "POST", body: form });
      toast(initial ? "Turma atualizada." : "Turma criada.");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Editar turma" : "Nova turma"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Jiu-Jitsu Adulto" />
        </Field>
        <Field label="Descrição">
          <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" />
        </Field>
        <Field label="Dias da semana" group>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  "h-11 w-12 cursor-pointer rounded-xl text-sm font-medium ring-1",
                  form.daysOfWeek.includes(day) ? "bg-zinc-900 text-zinc-50 ring-zinc-900" : "bg-surface text-zinc-600 ring-zinc-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Início">
            <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="Término">
            <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Público" group>
          <Segmented
            className="w-full"
            value={form.targetStudentType ?? "all"}
            onChange={(v) => setForm({ ...form, targetStudentType: v === "all" ? null : (v as StudentType) })}
            options={[
              { value: "all", label: "Todos" },
              { value: "Adult", label: "Adulto" },
              { value: "Child", label: "Infantil" },
            ]}
          />
        </Field>
        {initial && (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" className="size-4 accent-zinc-900" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Turma ativa
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function ClassesPage() {
  const { data: classes, error, reload } = useApi<TrainingClass[]>("/classes");
  const [editing, setEditing] = useState<{ item?: TrainingClass } | null>(null);
  const today = new Date().getDay();

  return (
    <>
      <PageHeader
        title="Turmas"
        description="Horários fixos da semana. Toque em uma turma para fazer a chamada."
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" />
            Nova turma
          </Button>
        }
      />

      {error && !classes ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !classes ? (
        <Spinner />
      ) : classes.length === 0 ? (
        <Card>
          <EmptyState icon={<School className="size-6" />} title="Nenhuma turma cadastrada" action={<Button onClick={() => setEditing({})}>Criar turma</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const isToday = c.active && c.daysOfWeek.includes(today);
            return (
              <Card key={c.id} className={cn("flex flex-col p-5", !c.active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-zinc-900">{c.name}</h2>
                    {c.description && <p className="mt-0.5 text-sm text-zinc-500">{c.description}</p>}
                  </div>
                  <button onClick={() => setEditing({ item: c })} className="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Editar turma">
                    <Pencil className="size-4" />
                  </button>
                </div>

                <div className="mt-4 flex gap-1">
                  {WEEKDAYS.map((label, day) => (
                    <span
                      key={day}
                      className={cn(
                        "flex h-8 flex-1 items-center justify-center rounded-lg text-xs font-medium",
                        c.daysOfWeek.includes(day) ? "bg-zinc-900 text-zinc-50" : "bg-zinc-50 text-zinc-300",
                        day === today && "ring-2 ring-emerald-400 ring-offset-1",
                      )}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4 text-zinc-400" />
                    {c.startTime} – {c.endTime}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-zinc-400" />
                    {c.enrolledCount} alunos
                  </span>
                  {c.targetStudentType && <Badge tone={c.targetStudentType === "Child" ? "blue" : "zinc"}>{c.targetStudentType === "Child" ? "Infantil" : "Adulto"}</Badge>}
                  {!c.active && <Badge>Inativa</Badge>}
                </div>

                <div className="mt-5 flex-1" />
                <Link href={`/presenca?turma=${c.id}`} className={buttonClass({ variant: isToday ? "success" : "secondary", className: "w-full" })}>
                  <CalendarCheck className="size-4" />
                  {isToday ? "Fazer chamada de hoje" : "Abrir chamada"}
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <ClassModal
          initial={editing.item}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
