"""Decide whether one captured frame is worth keeping for a given pose."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .geometry import pose_accepts, pose_failure_code
from .messages import message_for

MIN_DET_SCORE = 0.60
MIN_FACE_FRACTION = 0.18
MAX_FACE_FRACTION = 0.78
CENTER_TOLERANCE = 0.18
MIN_BRIGHTNESS = 45.0
MAX_BRIGHTNESS = 230.0
# Laplacian variance on the face crop. Close webcam frames land well above this.
# The library sample photo is a distant group shot, so its crops sit around 12–18;
# a strong Gaussian blur of those crops falls under 8.
MIN_SHARPNESS = 8.0


@dataclass
class Assessment:
    ok: bool
    code: str | None
    message: str
    det_score: float | None = None
    yaw: float | None = None
    pitch: float | None = None
    roll: float | None = None
    embedding: np.ndarray | None = None
    box: list[float] | None = None
    quality: dict | None = None


def _crop_stats(image: np.ndarray, box: np.ndarray) -> tuple[float, float, float, float]:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = [int(round(v)) for v in box]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(width, x2), min(height, y2)
    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return 0.0, 0.0, 0.0, 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    face_w = (x2 - x1) / width
    face_h = (y2 - y1) / height
    return brightness, sharpness, face_w, face_h


def assess_faces(image: np.ndarray, faces: list, pose: str, *, enrollment: bool) -> Assessment:
    usable = [face for face in faces if float(face.det_score) >= 0.5]
    if not usable:
        return Assessment(False, "no_face", message_for("no_face"))
    if enrollment and len(usable) > 1:
        return Assessment(False, "multiple", message_for("multiple"))

    face = max(usable, key=lambda item: float(item.det_score))
    box = np.asarray(face.bbox, dtype=float)
    height, width = image.shape[:2]
    x1, y1, x2, y2 = box
    brightness, sharpness, face_w, face_h = _crop_stats(image, box)
    center_x = ((x1 + x2) / 2) / width
    center_y = ((y1 + y2) / 2) / height
    pose_vals = None if face.pose is None else [float(v) for v in face.pose]
    pitch = pose_vals[0] if pose_vals else 0.0
    yaw = pose_vals[1] if pose_vals else 0.0
    roll = pose_vals[2] if pose_vals else 0.0
    quality = {
        "detScore": round(float(face.det_score), 4),
        "yaw": round(yaw, 2),
        "pitch": round(pitch, 2),
        "roll": round(roll, 2),
        "brightness": round(brightness, 1),
        "sharpness": round(sharpness, 1),
        "faceWidth": round(face_w, 3),
        "faceHeight": round(face_h, 3),
        "centerX": round(center_x, 3),
        "centerY": round(center_y, 3),
    }

    def fail(code: str) -> Assessment:
        return Assessment(
            False,
            code,
            message_for(code),
            det_score=float(face.det_score),
            yaw=yaw,
            pitch=pitch,
            roll=roll,
            box=[round(float(v), 1) for v in box],
            quality=quality,
        )

    if float(face.det_score) < MIN_DET_SCORE:
        return fail("no_face")
    if enrollment:
        if brightness < MIN_BRIGHTNESS:
            return fail("dark")
        if brightness > MAX_BRIGHTNESS:
            return fail("bright")
        if sharpness < MIN_SHARPNESS:
            return fail("blurry")
        if face_w < MIN_FACE_FRACTION or face_h < MIN_FACE_FRACTION:
            return fail("too_small")
        if face_w > MAX_FACE_FRACTION or face_h > MAX_FACE_FRACTION:
            return fail("too_large")
        if abs(center_x - 0.5) > CENTER_TOLERANCE or abs(center_y - 0.48) > CENTER_TOLERANCE:
            return fail("off_center")
        if pose_vals is None or not pose_accepts(pose, yaw, pitch, roll):
            return fail(pose_failure_code(pose))

    embedding = np.asarray(face.normed_embedding, dtype=np.float32)
    return Assessment(
        True,
        None,
        "ok",
        det_score=float(face.det_score),
        yaw=yaw,
        pitch=pitch,
        roll=roll,
        embedding=embedding,
        box=[round(float(v), 1) for v in (box if not enrollment else box)],
        quality=quality,
    )
