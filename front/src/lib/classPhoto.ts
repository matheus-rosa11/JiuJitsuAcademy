export interface PhotoAssignment {
  studentId: string | null;
  accepted: boolean;
}

export type FaceReading = "recognized" | "review" | "missing" | "no_profile";

export interface RollFace {
  role: "suggested" | "review" | "unknown";
  studentId: string | null;
  ambiguous?: boolean;
  candidates?: { studentId: string; decision: string }[];
}

export interface RollStudent {
  studentId: string;
  status: "suggested" | "review" | "pending";
  reason: string;
}

export interface PhotoRoll {
  present: Record<string, true>;
  reading: Record<string, FaceReading>;
  unknownFaces: number;
}

/** Confident, unambiguous matches become presences. Review and missing students stay unmarked. */
export function photoRoll(students: RollStudent[], faces: RollFace[]): PhotoRoll {
  const reading: Record<string, FaceReading> = {};
  for (const student of students) {
    if (student.status === "suggested") reading[student.studentId] = "recognized";
    else if (student.status === "review") reading[student.studentId] = "review";
    else if (student.reason === "no_profile") reading[student.studentId] = "no_profile";
    else reading[student.studentId] = "missing";
  }

  const suggestedCount = new Map<string, number>();
  for (const face of faces) {
    if (face.role === "suggested" && face.studentId) {
      suggestedCount.set(face.studentId, (suggestedCount.get(face.studentId) ?? 0) + 1);
    }
    if (!face.ambiguous) continue;
    for (const candidate of face.candidates ?? []) {
      if (candidate.decision === "UNKNOWN") continue;
      if (reading[candidate.studentId] === "missing" || reading[candidate.studentId] === "recognized") {
        reading[candidate.studentId] = "review";
      }
    }
  }
  for (const [studentId, count] of suggestedCount) {
    if (count > 1) reading[studentId] = "review";
  }

  const present: Record<string, true> = {};
  for (const [studentId, value] of Object.entries(reading)) {
    if (value === "recognized") present[studentId] = true;
  }
  return {
    present,
    reading,
    unknownFaces: faces.filter((face) => face.role === "unknown").length,
  };
}

export type PresenceUpdate =
  | { ok: true; present: Record<string, true> }
  | { ok: false; message: string };

/** Presences the professor accepted. Never writes an absence. */
export function presenceUpdates(faces: PhotoAssignment[]): PresenceUpdate {
  const present: Record<string, true> = {};
  for (const face of faces) {
    if (!face.accepted || !face.studentId) continue;
    if (present[face.studentId]) {
      return { ok: false, message: "Dois rostos foram atribuídos à mesma pessoa." };
    }
    present[face.studentId] = true;
  }
  return { ok: true, present };
}

/** Warning shown before saving a sheet that would record unconfirmed students as absent. */
export function absenceWarning(names: string[]): string | null {
  if (names.length === 0) return null;
  const shown = names.slice(0, 8).join(", ");
  const extra = names.length > 8 ? ` e mais ${names.length - 8}` : "";
  if (names.length === 1) {
    return `Salvar agora grava este aluno como ausente: ${shown}. A foto não confirma falta. Continuar?`;
  }
  return `Salvar agora grava estes alunos como ausentes: ${shown}${extra}. A foto não confirma falta. Continuar?`;
}

const MAX_SIDE = 1600;

export async function imageFileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Não conseguimos ler esta foto.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
