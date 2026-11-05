export interface PhotoAssignment {
  studentId: string | null;
  accepted: boolean;
}

export type FaceReading = "recognized" | "review" | "missing" | "no_profile";

export interface RollFace {
  role: "suggested" | "review" | "unknown" | "instructor";
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

export interface InstructorPerson {
  id: string;
  name: string;
  beltOrder: number;
  degree: number;
  isPrincipal: boolean;
}

function rankInstructors(a: InstructorPerson, b: InstructorPerson) {
  if (b.beltOrder !== a.beltOrder) return b.beltOrder - a.beltOrder;
  if (b.degree !== a.degree) return b.degree - a.degree;
  return a.name.localeCompare(b.name, "pt-BR");
}

/** Professors whose face was a confident match, principal first, then highest belt. */
export function matchedInstructors(
  professors: InstructorPerson[],
  faces: { role: string; studentId: string | null }[],
): InstructorPerson[] {
  const matched = new Set(
    faces
      .filter((face) => (face.role === "instructor" || face.role === "suggested") && face.studentId)
      .map((face) => face.studentId),
  );
  const present = professors.filter((professor) => matched.has(professor.id));
  const principals = present.filter((professor) => professor.isPrincipal);
  const others = present.filter((professor) => !professor.isPrincipal).sort(rankInstructors);
  return [...principals, ...others];
}

export function chooseInstructor(
  professors: InstructorPerson[],
  faces: { role: string; studentId: string | null }[],
): string | null {
  return matchedInstructors(professors, faces)[0]?.id ?? null;
}

export function nextInstructor(ids: string[], current: string | null): string | null {
  if (ids.length === 0) return null;
  const index = current ? ids.indexOf(current) : -1;
  return ids[(index + 1) % ids.length];
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
