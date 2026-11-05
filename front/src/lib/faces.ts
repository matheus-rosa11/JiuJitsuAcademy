import type { Pose } from "./faceGuide";

export interface FaceQuality {
  detScore: number;
  yaw: number;
  pitch: number;
  roll: number;
  brightness: number;
  sharpness: number;
  faceWidth: number;
  faceHeight: number;
  centerX: number;
  centerY: number;
}

export interface FaceCaptureInfo {
  pose: Pose;
  accepted?: boolean;
  detScore: number;
  yaw: number;
  embeddingDimensions: number;
  embeddingNorm?: number;
  embeddingPreview?: number[];
  embedding?: number[];
  quality: FaceQuality;
}

export interface FaceProfile {
  studentId: string;
  updatedAt: string;
  poses: Pose[];
  captures: FaceCaptureInfo[];
}

export interface FaceCheck {
  pose: Pose;
  accepted: boolean;
  quality: FaceQuality;
}

export interface RecognizedFace {
  box: number[];
  decision: "MATCHED" | "REVIEW" | "UNKNOWN";
  studentId: string | null;
  score: number | null;
  matchedPose: Pose | null;
  ambiguous: boolean;
  candidates: { studentId: string; score: number; decision: string; matchedPose: Pose }[];
}

export class FaceApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function faceApi<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api/faces${path}`, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  let data: { message?: string; code?: string } = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new FaceApiError(data.message ?? "Não conseguimos concluir o cadastro agora. Tente de novo.", response.status, data.code);
  }
  return data as T;
}

export function getFaceProfile(studentId: string, embeddings = false) {
  const query = embeddings ? "?embeddings=true" : "";
  return faceApi<FaceProfile>(`/${encodeURIComponent(studentId)}${query}`);
}

export function checkFace(pose: Pose, imageBase64: string) {
  return faceApi<FaceCheck>("/check", { method: "POST", body: { pose, imageBase64 } });
}

export function enrollFace(studentId: string, captures: { pose: Pose; imageBase64: string }[]) {
  return faceApi<{ studentId: string; updatedAt: string; captures: FaceCaptureInfo[] }>("/enroll", {
    method: "POST",
    body: { studentId, captures },
  });
}

export function deleteFace(studentId: string) {
  return faceApi<void>(`/${encodeURIComponent(studentId)}`, { method: "DELETE" });
}

export function demoSamples() {
  return faceApi<{ front: string; left: string; right: string; group: string }>("/demo/samples");
}

export function recognizeFaces(imageBase64: string, candidateStudentIds?: string[]) {
  return faceApi<{ faces: RecognizedFace[] }>("/recognize", {
    method: "POST",
    body: { imageBase64, candidateStudentIds },
  });
}

export interface AttendanceFace {
  index: number;
  box: number[] | null;
  role: "suggested" | "review" | "unknown" | "instructor";
  studentId: string | null;
  score: number | null;
  matchedPose: Pose | null;
  ambiguous: boolean;
  candidates: { studentId: string; score: number; decision: string; matchedPose: Pose }[];
}

export interface AttendanceStudent {
  studentId: string;
  status: "suggested" | "review" | "pending";
  reason: "matched" | "needs_review" | "no_profile" | "not_seen";
  faceIndex: number | null;
  score: number | null;
}

export interface AttendanceSuggestion {
  faces: AttendanceFace[];
  students: AttendanceStudent[];
  counts: { suggested: number; review: number; pending: number; unknownFaces: number };
  elapsedMs: number;
}

export function suggestAttendance(imageBase64: string, candidateStudentIds: string[], instructorStudentIds: string[] = []) {
  return faceApi<AttendanceSuggestion>("/attendance", {
    method: "POST",
    body: { imageBase64, candidateStudentIds, instructorStudentIds },
  });
}
