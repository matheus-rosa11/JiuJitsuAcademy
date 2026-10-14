import { boxFromLandmarks, eyesClosed, yawFromLandmarks, yawFromMatrix, type FrameReading } from "./faceGuide";

interface LandmarkerResult {
  faceLandmarks?: { x: number; y: number }[][];
  faceBlendshapes?: { categories?: { categoryName?: string; score?: number }[] }[];
  facialTransformationMatrixes?: { data?: ArrayLike<number> }[];
}

let loading: Promise<FaceLandmarkerLike> | null = null;

interface FaceLandmarkerLike {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => LandmarkerResult;
  close?: () => void;
}

export function loadFaceGuide(): Promise<FaceLandmarkerLike> {
  if (!loading) {
    loading = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks("/mediapipe");
      return vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "/models/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

export function readingFromResult(result: LandmarkerResult, brightness: number | null): FrameReading {
  const faces = result.faceLandmarks ?? [];
  const landmarks = faces[0];
  if (!landmarks) {
    return {
      faceCount: 0,
      centerX: null,
      centerY: null,
      faceWidth: null,
      faceHeight: null,
      brightness,
      yaw: null,
      eyesClosed: false,
    };
  }
  const box = boxFromLandmarks(landmarks);
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  const yaw = (matrix ? yawFromMatrix(matrix) : null) ?? yawFromLandmarks(landmarks);
  return {
    faceCount: faces.length,
    ...box,
    brightness,
    yaw,
    eyesClosed: eyesClosed(result.faceBlendshapes?.[0]?.categories),
  };
}
