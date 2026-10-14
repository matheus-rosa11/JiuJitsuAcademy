"use client";

import { Camera, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { imageFileToDataUrl, presenceUpdates, type PhotoAssignment } from "@/lib/classPhoto";
import { demoSamples, FaceApiError, suggestAttendance, type AttendanceFace, type AttendanceSuggestion } from "@/lib/faces";

interface RosterStudent {
  studentId: string;
  name: string;
}

interface Assignment extends PhotoAssignment {
  index: number;
  role: AttendanceFace["role"];
  box: number[] | null;
}

export function ClassPhotoRoll({
  students,
  onApply,
  onPhotoActive,
  onStatuses,
  onUnconfirmed,
}: {
  students: RosterStudent[];
  onApply: (present: Record<string, true>) => void;
  onPhotoActive: (active: boolean) => void;
  onStatuses: (statuses: Record<string, { status: string; reason: string }>) => void;
  onUnconfirmed: (studentIds: string[]) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AttendanceSuggestion | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  function publish(next: Assignment[], suggestion: AttendanceSuggestion | null) {
    setAssignments(next);
    const confirmed = new Set(next.filter((face) => face.accepted && face.studentId).map((face) => face.studentId as string));
    onUnconfirmed(students.filter((student) => !confirmed.has(student.studentId)).map((student) => student.studentId));
    onStatuses(
      Object.fromEntries(
        (suggestion?.students ?? []).map((student) => [student.studentId, { status: student.status, reason: student.reason }]),
      ),
    );
  }

  function clearPhoto() {
    setPreview(null);
    setResult(null);
    setAssignments([]);
    setNatural(null);
    setSample(false);
    setError(null);
    onPhotoActive(false);
    onUnconfirmed([]);
    onStatuses({});
  }

  async function submit(imageBase64: string, fromSample: boolean) {
    setBusy(true);
    setError(null);
    try {
      const suggestion = await suggestAttendance(
        imageBase64,
        students.map((student) => student.studentId),
      );
      const next = suggestion.faces.map((face) => ({
        index: face.index,
        role: face.role,
        box: face.box,
        studentId: face.studentId,
        accepted: face.role === "suggested" && Boolean(face.studentId),
      }));
      setPreview(imageBase64);
      setResult(suggestion);
      setSample(fromSample);
      setNatural(null);
      onPhotoActive(true);
      publish(next, suggestion);
    } catch (caught) {
      const message = caught instanceof FaceApiError ? caught.message : "Não conseguimos ler esta foto. Tente de novo.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const imageBase64 = await imageFileToDataUrl(file);
      await submit(imageBase64, false);
    } catch {
      setError("Não conseguimos ler esta foto.");
      setBusy(false);
    }
  }

  async function loadSample() {
    setBusy(true);
    setError(null);
    try {
      const samples = await demoSamples();
      await submit(samples.group, true);
    } catch {
      setError("Não conseguimos carregar a foto de exemplo.");
      setBusy(false);
    }
  }

  function update(index: number, patch: Partial<Assignment>) {
    if (!result) return;
    publish(
      assignments.map((face) => (face.index === index ? { ...face, ...patch } : face)),
      result,
    );
  }

  const decision = presenceUpdates(assignments);
  const acceptedCount = decision.ok ? Object.keys(decision.present).length : 0;
  const seconds = result ? (result.elapsedMs / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Foto da turma</h2>
          <p className="mt-1 text-sm text-zinc-600">A foto sugere presenças. Ela não marca falta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => cameraRef.current?.click()} loading={busy}>
            <Camera className="size-4" /> Tirar foto
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="size-4" /> Enviar foto
          </Button>
          {process.env.NODE_ENV === "development" && (
            <Button type="button" size="sm" variant="ghost" onClick={loadSample} disabled={busy}>
              Foto de exemplo (não é uma turma)
            </Button>
          )}
        </div>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void readFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void readFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {sample && preview && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta imagem é um exemplo da biblioteca. Não é uma foto da turma.
        </p>
      )}
      {preview && result && (
        <div className="space-y-4">
          <div className="flex justify-center overflow-hidden rounded-xl bg-zinc-950">
            <div className="relative max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Foto enviada para a chamada"
              className="block max-h-[28rem] max-w-full"
              onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            />
            {natural &&
              assignments.map((face) => {
                if (!face.box || face.box.length < 4) return null;
                const [x1, y1, x2, y2] = face.box;
                const tone = face.role === "suggested" ? "border-emerald-400" : face.role === "review" ? "border-amber-400" : "border-white";
                return (
                  <span
                    key={face.index}
                    className={`pointer-events-none absolute border-2 ${tone}`}
                    style={{
                      left: `${(x1 / natural.width) * 100}%`,
                      top: `${(y1 / natural.height) * 100}%`,
                      width: `${((x2 - x1) / natural.width) * 100}%`,
                      height: `${((y2 - y1) / natural.height) * 100}%`,
                    }}
                  />
                );
              })}
            </div>
          </div>
          <p className="text-sm text-zinc-600">
            {result.counts.suggested} presenças sugeridas · {result.counts.review} para revisar · {result.counts.pending} pendentes ·{" "}
            {result.counts.unknownFaces} {result.counts.unknownFaces === 1 ? "rosto desconhecido" : "rostos desconhecidos"}
            {seconds ? ` · Leitura da foto: ${seconds} s` : ""}
          </p>
          {result.faces.length === 0 && <p className="text-sm text-zinc-700">Não encontramos rostos nesta foto.</p>}
          <ul className="space-y-2">
            {assignments.map((face) => (
              <li key={face.index} className="flex flex-col gap-2 rounded-xl bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    className="size-4 accent-emerald-600"
                    checked={face.accepted}
                    disabled={!face.studentId}
                    onChange={(event) => update(face.index, { accepted: event.target.checked })}
                  />
                  {!face.studentId ? "Rosto não identificado" : face.role === "review" ? "Confira" : face.role === "unknown" ? "Atribuído pelo professor" : "Presença sugerida"}
                </label>
                <select
                  className="h-10 flex-1 rounded-xl bg-white px-3 text-sm text-zinc-900 ring-1 ring-zinc-200"
                  value={face.studentId ?? ""}
                  onChange={(event) => {
                    const studentId = event.target.value || null;
                    update(face.index, {
                      studentId,
                      accepted: face.role === "unknown" ? Boolean(studentId) : face.accepted,
                    });
                  }}
                  aria-label={`Aluno do rosto ${face.index + 1}`}
                >
                  <option value="">Não sei quem é</option>
                  {students.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {!decision.ok && <p className="text-sm text-red-700">{decision.message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="success"
              disabled={!decision.ok || acceptedCount === 0}
              onClick={() => {
                if (decision.ok) onApply(decision.present);
              }}
            >
              Aplicar presenças sugeridas
            </Button>
            <Button type="button" variant="ghost" onClick={clearPhoto}>
              Escolher outra foto
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
