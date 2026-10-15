export interface PhotoAssignment {
  studentId: string | null;
  accepted: boolean;
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
