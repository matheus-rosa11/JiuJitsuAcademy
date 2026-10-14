"""InsightFace runtime. One process, one model, serialized inference."""

from __future__ import annotations

import threading

import numpy as np

from .images import fit_image
from .quality import Assessment, assess_faces

_lock = threading.Lock()
_app = None


def get_app():
    global _app
    if _app is None:
        from insightface.app import FaceAnalysis

        runtime = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        runtime.prepare(ctx_id=-1, det_size=(640, 640))
        _app = runtime
    return _app


def detect(image: np.ndarray):
    with _lock:
        return get_app().get(image)


def analyze(image: np.ndarray, pose: str, *, enrollment: bool) -> tuple[Assessment, np.ndarray, float]:
    fitted, scale = fit_image(image)
    with _lock:
        faces = get_app().get(fitted)
    assessment = assess_faces(fitted, faces, pose, enrollment=enrollment)
    if assessment.box is not None and scale != 1.0:
        assessment.box = [round(value / scale, 1) for value in assessment.box]
    return assessment, fitted, scale


def recognize_faces(image: np.ndarray) -> list[tuple[Assessment, list[float]]]:
    """Every detectable face in a class photo. Position gates stay off."""
    fitted, scale = fit_image(image)
    with _lock:
        faces = get_app().get(fitted)
    found = []
    for face in faces:
        if float(face.det_score) < 0.5:
            continue
        one = assess_faces(fitted, [face], "front", enrollment=False)
        if one.embedding is None or one.box is None:
            continue
        box = one.box if scale == 1.0 else [round(value / scale, 1) for value in one.box]
        found.append((one, box))
    return found
