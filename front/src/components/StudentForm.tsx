"use client";

import { Baby, Plus, Star, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, type Belt, type Responsible, type StudentDetail, type StudentType, type TrainingClass } from "@/lib/api";
import { ageFrom, formatDays, todayIso } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { BeltPicker, DegreePicker } from "./BeltPicker";
import { useToast } from "./Toast";
import { Button, Card, cn, Field, Input, Select, Spinner, Textarea } from "./ui";

interface ResponsibleRow {
  key: string;
  responsibleId: string | null;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
}

const RELATIONSHIPS = ["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Responsável legal"];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function StudentForm({ initial }: { initial?: StudentDetail }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initial;

  const [type, setType] = useState<StudentType>(initial?.studentType ?? "Adult");
  const [name, setName] = useState(initial?.name ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [joinedAt, setJoinedAt] = useState(initial?.joinedAt ?? todayIso());
  const [active, setActive] = useState(initial?.active ?? true);
  const [beltId, setBeltId] = useState(initial?.currentBeltId ?? "");
  const [degree, setDegree] = useState(initial?.currentDegree ?? 0);
  const [monthlyFee, setMonthlyFee] = useState(String(initial?.monthlyFee ?? ""));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [classIds, setClassIds] = useState<string[]>(initial?.classes.map((c) => c.id) ?? []);
  const [responsibles, setResponsibles] = useState<ResponsibleRow[]>(
    initial?.responsibles.map((r) => ({
      key: r.responsibleId,
      responsibleId: r.responsibleId,
      name: r.name,
      phone: r.phone ?? "",
      email: r.email ?? "",
      relationship: r.relationship,
      isPrimary: r.isPrimary,
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);

  const { data: beltData, loading: beltsLoading } = useApi<Belt[]>(`/belts?studentType=${type}`);
  const { data: classes } = useApi<TrainingClass[]>("/classes");
  const { data: existingResponsibles } = useApi<Responsible[]>(type === "Child" ? "/responsibles" : null);

  // Never render belts from the other system, even while the new list is loading.
  const belts = beltsLoading ? undefined : beltData?.filter((b) => b.category === type);
  const belt = belts?.find((b) => b.id === beltId) ?? belts?.[0];
  const effectiveDegree = belt ? Math.min(degree, belt.maxDegree) : 0;
  const compatibleClasses = (classes ?? []).filter((c) => c.active && (!c.targetStudentType || c.targetStudentType === type));
  const age = ageFrom(birthDate);
  const beltChanged = isEdit && belt && (belt.id !== initial.currentBeltId || effectiveDegree !== initial.currentDegree);

  function changeType(next: StudentType) {
    setType(next);
    setBeltId("");
    setDegree(0);
  }

  function addResponsible(existing?: Responsible) {
    setResponsibles((rows) => [
      ...rows,
      {
        key: existing?.id ?? crypto.randomUUID(),
        responsibleId: existing?.id ?? null,
        name: existing?.name ?? "",
        phone: existing?.phone ?? "",
        email: existing?.email ?? "",
        relationship: rows.length === 0 ? "Mãe" : "Pai",
        isPrimary: rows.length === 0,
      },
    ]);
  }

  function updateResponsible(key: string, patch: Partial<ResponsibleRow>) {
    setResponsibles((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : patch.isPrimary ? { ...r, isPrimary: false } : r)),
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!belt) return;
    setSaving(true);
    try {
      const body = {
        name,
        birthDate,
        phone: phone || null,
        email: email || null,
        joinedAt,
        active,
        studentType: type,
        currentBeltId: belt.id,
        currentDegree: effectiveDegree,
        monthlyFee: Number(monthlyFee.replace(",", ".")) || 0,
        notes: notes || null,
        classIds: classIds.filter((id) => compatibleClasses.some((c) => c.id === id)),
        responsibles:
          type === "Child"
            ? responsibles.map((r) => ({
                responsibleId: r.responsibleId,
                name: r.responsibleId ? null : r.name,
                phone: r.responsibleId ? null : r.phone || null,
                email: r.responsibleId ? null : r.email || null,
                relationship: r.relationship,
                isPrimary: r.isPrimary,
              }))
            : [],
      };
      const saved = await api<StudentDetail>(isEdit ? `/students/${initial.id}` : "/students", {
        method: isEdit ? "PUT" : "POST",
        body,
      });
      toast(isEdit ? "Aluno atualizado." : `${saved.name} cadastrado com sucesso!`);
      router.push(`/alunos/${saved.id}`);
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }

  const linkedIds = new Set(responsibles.map((r) => r.responsibleId).filter(Boolean));

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section title="Tipo de aluno" description="Define o sistema de faixas (adulto ou infantil) e se há responsáveis.">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "Adult", label: "Adulto", hint: "Branca → Preta", icon: User },
              { value: "Child", label: "Infantil", hint: "Branca → Verde/Preta", icon: Baby },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => changeType(o.value)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl p-4 text-left ring-1 transition-all",
                type === o.value ? "bg-zinc-900 text-zinc-50 ring-zinc-900" : "bg-surface ring-zinc-200 hover:ring-zinc-400",
              )}
            >
              <o.icon className="size-6 shrink-0" />
              <div>
                <p className="font-semibold">{o.label}</p>
                <p className={cn("text-xs", type === o.value ? "text-zinc-400" : "text-zinc-500")}>{o.hint}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Dados pessoais">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" className="sm:col-span-2">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" />
          </Field>
          <Field
            label="Data de nascimento"
            hint={
              age !== null &&
              (type === "Adult" && age < 16 ? (
                <span className="text-amber-600">{age} anos — considere o cadastro infantil.</span>
              ) : type === "Child" && age >= 16 ? (
                <span className="text-amber-600">{age} anos — considere o cadastro adulto.</span>
              ) : (
                `${age} anos`
              ))
            }
          >
            <Input required type="date" max={todayIso()} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="Início na academia">
            <Input required type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </Field>
        </div>
      </Section>

      <Section
        title="Faixa e grau"
        description={type === "Adult" ? "Somente faixas do sistema adulto." : "Somente faixas do sistema infantil."}
      >
        {!belts || !belt ? (
          <Spinner label="Carregando faixas..." />
        ) : (
          <div className="space-y-5">
            <BeltPicker belts={belts} value={belt.id} onChange={setBeltId} />
            <Field label="Grau" group>
              <DegreePicker max={belt.maxDegree} value={effectiveDegree} onChange={setDegree} />
            </Field>
            {beltChanged && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                A mudança de faixa/grau será registrada no histórico com a data de hoje. Para escolher a data, use
                &quot;Registrar graduação&quot; na página do aluno.
              </p>
            )}
          </div>
        )}
      </Section>

      {type === "Child" && (
        <Section title="Responsáveis" description="Um responsável pode estar vinculado a vários alunos (irmãos).">
          <div className="space-y-3">
            {responsibles.map((r) => (
              <div key={r.key} className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                  {r.responsibleId ? (
                    <div className="flex h-11 items-center rounded-xl bg-surface px-3.5 text-sm font-medium ring-1 ring-zinc-200">
                      {r.name}
                      <span className="ml-2 text-xs font-normal text-zinc-500">{r.phone}</span>
                    </div>
                  ) : (
                    <Input required placeholder="Nome do responsável" value={r.name} onChange={(e) => updateResponsible(r.key, { name: e.target.value })} />
                  )}
                  <Input
                    list="relationships"
                    placeholder="Parentesco"
                    value={r.relationship}
                    onChange={(e) => updateResponsible(r.key, { relationship: e.target.value })}
                  />
                </div>
                {!r.responsibleId && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input type="tel" placeholder="Telefone" value={r.phone} onChange={(e) => updateResponsible(r.key, { phone: e.target.value })} />
                    <Input type="email" placeholder="E-mail" value={r.email} onChange={(e) => updateResponsible(r.key, { email: e.target.value })} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => updateResponsible(r.key, { isPrimary: true })}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium",
                      r.isPrimary ? "bg-amber-100 text-amber-800" : "text-zinc-500 hover:bg-zinc-100",
                    )}
                  >
                    <Star className={cn("size-3.5", r.isPrimary && "fill-current")} />
                    {r.isPrimary ? "Principal" : "Marcar como principal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResponsibles((rows) => rows.filter((x) => x.key !== r.key))}
                    className="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover responsável"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
            <datalist id="relationships">
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value=""
                onChange={(e) => {
                  const found = existingResponsibles?.find((x) => x.id === e.target.value);
                  if (found) addResponsible(found);
                }}
                className="sm:max-w-sm"
              >
                <option value="">Vincular responsável já cadastrado...</option>
                {existingResponsibles
                  ?.filter((x) => !linkedIds.has(x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.students.length > 0 ? ` (${x.students.map((s) => s.name.split(" ")[0]).join(", ")})` : ""}
                    </option>
                  ))}
              </Select>
              <Button type="button" variant="secondary" onClick={() => addResponsible()}>
                <Plus className="size-4" />
                Novo responsável
              </Button>
            </div>
          </div>
        </Section>
      )}

      <Section title="Turmas">
        {compatibleClasses.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma turma disponível para este tipo de aluno.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {compatibleClasses.map((c) => {
              const checked = classIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 transition-all",
                    checked ? "bg-zinc-50 ring-zinc-900" : "ring-zinc-200 hover:ring-zinc-400",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-zinc-900"
                    checked={checked}
                    onChange={() => setClassIds((ids) => (checked ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{c.name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDays(c.daysOfWeek)} · {c.startTime}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Mensalidade e observações">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mensalidade (R$)">
            <Input inputMode="decimal" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} placeholder="180,00" />
          </Field>
          {isEdit && (
            <Field label="Situação">
              <Select value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </Select>
            </Field>
          )}
          <Field label="Observações" className="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lesões, restrições, objetivos..." />
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-20 z-20 flex justify-end gap-2 rounded-2xl bg-surface/90 p-3 ring-1 ring-zinc-200 backdrop-blur lg:bottom-4">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving} disabled={!belt}>
          {isEdit ? "Salvar alterações" : "Cadastrar aluno"}
        </Button>
      </div>
    </form>
  );
}
