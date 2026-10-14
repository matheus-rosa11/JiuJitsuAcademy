/** Live guidance for facial enrollment. This file has no model code. */

export type Pose = "front" | "left" | "right";

export const POSES: Pose[] = ["front", "left", "right"];

/** How long the face must stay acceptable before the frame is sent. */
export const HOLD_MS = 800;

/**
 * Degrees of estimated yaw per unit of nose offset.
 * Offset is (noseX - eyeMidX) / eyeSpan on the unmirrored image.
 * Positive means the subject's left, the same sign InsightFace uses.
 */
export const YAW_PER_OFFSET = 120;

/** Applied to the facial-transformation matrix. Flip only if a browser check disagrees with InsightFace. */
export const MATRIX_YAW_SIGN = 1;

export interface FrameReading {
  faceCount: number;
  centerX: number | null;
  centerY: number | null;
  faceWidth: number | null;
  faceHeight: number | null;
  brightness: number | null;
  /** Degrees. Positive is the subject's left. */
  yaw: number | null;
  eyesClosed: boolean;
}

export interface GuideVerdict {
  ok: boolean;
  code: string;
}

const CLIENT_FRONT_YAW = 18;
const CLIENT_TURN_YAW = 8;

const HINTS: Record<string, string> = {
  no_face: "Não conseguimos identificar seu rosto",
  multiple: "Apenas uma pessoa por vez",
  too_small: "Aproxime um pouco o rosto",
  too_large: "Afaste um pouco o rosto",
  off_center: "Posicione seu rosto no centro",
  dark: "Encontre um local mais iluminado",
  bright: "Encontre um local mais iluminado",
  not_front: "Olhe diretamente para a câmera",
  not_left: "Agora vire lentamente o rosto para a esquerda",
  not_right: "Agora vire lentamente o rosto para a direita",
  ready: "Olhe diretamente para a câmera",
};

export function assessReading(step: Pose, reading: FrameReading): GuideVerdict {
  if (reading.faceCount <= 0) return { ok: false, code: "no_face" };
  if (reading.faceCount > 1) return { ok: false, code: "multiple" };
  if (reading.brightness != null && reading.brightness < 42) return { ok: false, code: "dark" };
  if (reading.brightness != null && reading.brightness > 232) return { ok: false, code: "bright" };
  if (reading.faceWidth == null || reading.faceHeight == null || reading.centerX == null || reading.centerY == null) {
    return { ok: false, code: "no_face" };
  }
  const face = Math.max(reading.faceWidth, reading.faceHeight);
  if (face < 0.16) return { ok: false, code: "too_small" };
  if (face > 0.92) return { ok: false, code: "too_large" };
  if (Math.abs(reading.centerX - 0.5) > 0.2 || Math.abs(reading.centerY - 0.46) > 0.22) {
    return { ok: false, code: "off_center" };
  }
  if (step === "front" && reading.eyesClosed) return { ok: false, code: "not_front" };
  if (reading.yaw == null) {
    return { ok: false, code: step === "front" ? "not_front" : step === "left" ? "not_left" : "not_right" };
  }
  if (step === "front" && Math.abs(reading.yaw) > CLIENT_FRONT_YAW) return { ok: false, code: "not_front" };
  if (step === "left" && reading.yaw < CLIENT_TURN_YAW) return { ok: false, code: "not_left" };
  if (step === "right" && reading.yaw > -CLIENT_TURN_YAW) return { ok: false, code: "not_right" };
  return { ok: true, code: "ready" };
}

export type GuidePhase = "seek" | "hold" | "perfect" | "processing" | "done";

export function instructionFor(step: Pose, code: string, phase: GuidePhase): string {
  if (phase === "perfect") return "Perfeito!";
  if (phase === "processing") return "Processando...";
  if (phase === "done") return "Cadastro facial concluído!";
  if (phase === "hold") return "Capturando...";
  if (code === "no_face" && step === "front") return "Posicione seu rosto dentro do círculo";
  if (code === "ready" && step === "front") return "Olhe diretamente para a câmera";
  return HINTS[code] ?? "Posicione seu rosto dentro do círculo";
}

export function advanceHold(heldMs: number, ok: boolean, deltaMs: number): number {
  if (!ok) return 0;
  const step = Math.min(200, Math.max(0, deltaMs));
  return Math.min(HOLD_MS, heldMs + step);
}

export function holdComplete(heldMs: number): boolean {
  return heldMs >= HOLD_MS;
}

export function nextPose(step: Pose): Pose | null {
  if (step === "front") return "left";
  if (step === "left") return "right";
  return null;
}

/** Column-major 4x4 facial matrix → yaw in degrees. */
export function yawFromMatrix(data: ArrayLike<number>): number | null {
  if (data.length < 11) return null;
  const yaw = Math.atan2(data[8], data[10]) * (180 / Math.PI);
  if (!Number.isFinite(yaw)) return null;
  return MATRIX_YAW_SIGN * yaw;
}

/**
 * Nose tip (1) against the outer eye corners (33 image-left, 263 image-right).
 * Used when the transformation matrix is absent.
 */
export function yawFromLandmarks(landmarks: { x: number; y: number }[]): number | null {
  const nose = landmarks[1];
  const imageLeftEye = landmarks[33];
  const imageRightEye = landmarks[263];
  if (!nose || !imageLeftEye || !imageRightEye) return null;
  const span = Math.abs(imageRightEye.x - imageLeftEye.x);
  if (span < 0.02) return null;
  const mid = (imageLeftEye.x + imageRightEye.x) / 2;
  return ((nose.x - mid) / span) * YAW_PER_OFFSET;
}

export function boxFromLandmarks(landmarks: { x: number; y: number }[]) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    faceWidth: maxX - minX,
    faceHeight: maxY - minY,
  };
}

export function eyesClosed(categories: { categoryName?: string; score?: number }[] | undefined): boolean {
  if (!categories?.length) return false;
  const score = (name: string) => categories.find((item) => item.categoryName === name)?.score ?? 0;
  return score("eyeBlinkLeft") > 0.55 && score("eyeBlinkRight") > 0.55;
}

export function brightnessOf(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  box: { centerX: number; centerY: number; faceWidth: number; faceHeight: number },
): number {
  const x0 = Math.max(0, Math.floor((box.centerX - box.faceWidth / 2) * width));
  const y0 = Math.max(0, Math.floor((box.centerY - box.faceHeight / 2) * height));
  const x1 = Math.min(width, Math.ceil((box.centerX + box.faceWidth / 2) * width));
  const y1 = Math.min(height, Math.ceil((box.centerY + box.faceHeight / 2) * height));
  const stepX = Math.max(1, Math.floor((x1 - x0) / 16));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 16));
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const index = (y * width + x) * 4;
      sum += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
      count += 1;
    }
  }
  return count ? sum / count : 0;
}

/** Subject's left is on the viewer's left only while the preview is mirrored. */
export function turnHintSide(step: Pose, mirror: boolean): "left" | "right" | null {
  if (step === "front") return null;
  const subjectLeftOnViewerLeft = mirror;
  if (step === "left") return subjectLeftOnViewerLeft ? "left" : "right";
  return subjectLeftOnViewerLeft ? "right" : "left";
}
