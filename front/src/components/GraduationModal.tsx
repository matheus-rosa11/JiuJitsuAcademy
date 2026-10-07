"use client";

import { Award, ArrowRight } from "lucide-react";
import { useState } from "react";
import { api, type Belt, type StudentType } from "@/lib/api";
import { studentTypeLabel, todayIso } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { BeltBadge } from "./BeltBadge";
import { BeltPicker, DegreePicker } from "./BeltPicker";
import { useToast } from "./Toast";
import { Badge, Button, Field, Input, Modal, Spinner, Textarea } from "./ui";

export interface GraduationTarget {
  id: string;
  name: string;
  studentType: StudentType;
  currentBeltId: string;
  beltName: string;
  currentDegree: number;
}

/** Next step: one more degree, or the next belt once the current one is maxed out. */
function suggestNext(belts: Belt[], student: GraduationTarget) {
  const index = belts.findIndex((b) => b.id === student.currentBeltId);
  const current = belts[index];
  if (!current) return { beltId: belts[0]?.id ?? "", degree: 0 };
  if (student.currentDegree < current.maxDegree) return { beltId: current.id, degree: student.currentDegree + 1 };
  const next = belts[index + 1];
  return next ? { beltId: next.id, degree: 0 } : { beltId: current.id, degree: student.currentDegree };
}

export function GraduationModal({
  student,
  onClose,
  onSaved,
}: {
  student: GraduationTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { data: belts } = useApi<Belt[]>(`/belts?studentType=${student.studentType}`);
  const [selection, setSelection] = useState<{ beltId: string; degree: number } | null>(null);
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const value = selection ?? (belts ? suggestNext(belts, student) : null);
  const belt = belts?.find((b) => b.id === value?.beltId);
  const isBeltChange = value !== null && value.beltId !== student.currentBeltId;

  async function save() {
    if (!value) return;
    setSaving(true);
    try {
      await api(`/students/${student.id}/graduations`, {
        method: "POST",
        body: { beltId: value.beltId, degree: value.degree, date, notes: notes || null },
      });
      toast(isBeltChange ? `Nova faixa registrada para ${student.name}!` : `Grau registrado para ${student.name}!`);
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
      title="Registrar graduação"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={!value}>
            <Award className="size-4" />
            Registrar
          </Button>
        </>
      }
    >
      {!belts || !value || !belt ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-zinc-50 p-4">
            <div>
              <p className="text-xs text-zinc-500">Atual</p>
              <div className="mt-1 flex items-center gap-2">
                <BeltBadge name={student.beltName} degree={student.currentDegree} />
                <span className="text-sm font-medium">{student.beltName}</span>
              </div>
            </div>
            <ArrowRight className="size-4 text-zinc-400" />
            <div>
              <p className="text-xs text-zinc-500">Nova</p>
              <div className="mt-1 flex items-center gap-2">
                <BeltBadge name={belt.name} degree={value.degree} />
                <span className="text-sm font-medium">{belt.name}</span>
              </div>
            </div>
            <div className="ml-auto">
              {isBeltChange ? <Badge tone="violet">Troca de faixa</Badge> : <Badge>Troca de grau</Badge>}
            </div>
          </div>

          <Field label={`Faixa (sistema ${studentTypeLabel(student.studentType).toLowerCase()})`} group>
            <BeltPicker
              belts={belts}
              value={value.beltId}
              onChange={(beltId) => setSelection({ beltId, degree: beltId === value.beltId ? value.degree : 0 })}
            />
          </Field>

          <Field label="Grau" group>
            <DegreePicker max={belt.maxDegree} value={value.degree} onChange={(degree) => setSelection({ beltId: value.beltId, degree })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Observações">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: graduação de fim de semestre" />
          </Field>

          <p className="text-xs text-zinc-500">O histórico anterior é mantido. A faixa atual do aluno passa a ser a graduação mais recente.</p>
        </div>
      )}
    </Modal>
  );
}
