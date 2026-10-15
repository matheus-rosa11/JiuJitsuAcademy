"use client";

import { Camera, ScanFace, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { imageFileToDataUrl, photoRoll, type FaceReading } from "@/lib/classPhoto";
import { demoSamples, FaceApiError, suggestAttendance, type AttendanceSuggestion } from "@/lib/faces";

interface RosterStudent {
  studentId: string;
  name: string;
}

export function ClassPhotoRoll({
  students,
  onRecognized,
  onFocus,
  onClear,
}: {
  students: RosterStudent[];
  onRecognized: (present: Record<string, true>, reading: Record<string, FaceReading>) => void;
  onFocus: (studentId: string) => void;
  onClear: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const names = new Map(students.map((student) => [student.studentId, student.name]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AttendanceSuggestion | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  function clearPhoto() {
    setPreview(null);
    setResult(null);
    setNatural(null);
    setSample(false);
    setError(null);
    onClear();
  }

  async function submit(imageBase64: string, fromSample: boolean) {
    setBusy(true);
    setError(null);
    try {
      const suggestion = await suggestAttendance(
        imageBase64,
        students.map((student) => student.studentId),
      );
      const roll = photoRoll(suggestion.students, suggestion.faces);
      setPreview(imageBase64);
      setResult(suggestion);
      setSample(fromSample);
      setNatural(null);
      onRecognized(roll.present, roll.reading);
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

  const roll = result ? photoRoll(result.students, result.faces) : null;
  const seconds = result ? (result.elapsedMs / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;
  const recognized = roll ? Object.values(roll.reading).filter((value) => value === "recognized").length : 0;
  const review = roll ? Object.values(roll.reading).filter((value) => value === "review").length : 0;
  const missing = roll ? Object.values(roll.reading).filter((value) => value === "missing").length : 0;
  const noProfile = roll ? Object.values(roll.reading).filter((value) => value === "no_profile").length : 0;

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Foto da turma</h2>
          <p className="mt-1 max-w-md text-sm text-zinc-600">Quem for reconhecido entra como presente. Quem não aparecer fica sem presença.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => cameraRef.current?.click()} loading={busy}>
            <Camera className="size-4" /> Tirar foto
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="size-4" /> Enviar foto
          </Button>
          {process.env.NODE_ENV === "development" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => void loadSample()} disabled={busy}>
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
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Esta imagem é um exemplo da biblioteca. Não é uma foto da turma.</p>
      )}
      {preview && result && roll && (
        <div className="space-y-3">
          <div className="flex justify-center overflow-hidden rounded-xl bg-black">
            <div className="relative max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Foto enviada para a chamada"
                className="block max-h-[28rem] max-w-full"
                onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              />
              {natural &&
                result.faces.map((face) => {
                  if (!face.box || face.box.length < 4) return null;
                  const [x1, y1, x2, y2] = face.box;
                  const linked = face.studentId && roll.reading[face.studentId] !== "missing" && roll.reading[face.studentId] !== "no_profile" ? face.studentId : null;
                  const needsReview = linked ? roll.reading[linked] === "review" || face.role === "review" : false;
                  const known = Boolean(linked) && face.role !== "unknown";
                  const boxStyle = {
                    left: `${(x1 / natural.width) * 100}%`,
                    top: `${(y1 / natural.height) * 100}%`,
                    width: `${((x2 - x1) / natural.width) * 100}%`,
                    height: `${((y2 - y1) / natural.height) * 100}%`,
                  };
                  if (!known || !linked) {
                    return (
                      <span key={face.index} className="pointer-events-none absolute border-2 border-white" style={boxStyle}>
                        <span className="absolute -top-2 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">?</span>
                      </span>
                    );
                  }
                  return (
                    <button
                      key={face.index}
                      type="button"
                      className={`absolute border-2 ${needsReview ? "border-amber-300" : "border-emerald-300"}`}
                      style={boxStyle}
                      aria-label={`Ver ${names.get(linked) ?? "aluno"} na lista`}
                      onClick={() => onFocus(linked)}
                    >
                      <span className={`absolute -top-2 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full ${needsReview ? "bg-amber-300 text-black" : "bg-emerald-300 text-black"}`}>
                        <ScanFace className="size-3.5" />
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
          <p className="text-sm text-zinc-700">
            {recognized} {recognized === 1 ? "reconhecido" : "reconhecidos"}
            {review > 0 ? ` · ${review} ${review === 1 ? "incerto" : "incertos"}` : ""}
            {" · "}
            {missing} não {missing === 1 ? "está" : "estão"} na foto
            {noProfile > 0 ? ` · ${noProfile} sem cadastro facial` : ""}
            {roll.unknownFaces > 0 ? ` · ${roll.unknownFaces} ${roll.unknownFaces === 1 ? "rosto" : "rostos"} com ?` : ""}
            {seconds ? ` · ${seconds} s` : ""}
          </p>
          {result.faces.length === 0 && <p className="text-sm text-zinc-700">Não encontramos rostos nesta foto.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-500">Toque no rosto verde ou amarelo para achar o aluno na lista.</p>
            <button type="button" className="cursor-pointer text-sm text-zinc-500 underline-offset-2 hover:underline" onClick={clearPhoto}>
              Escolher outra foto
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
