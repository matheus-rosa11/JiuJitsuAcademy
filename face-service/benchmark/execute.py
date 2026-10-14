"""Enrollment and recognition for a dataset. Imported only when a dataset exists."""

from __future__ import annotations

import time
from pathlib import Path

import cv2
import numpy as np

from app.attendance import assemble_roll
from app.decisions import rank_students
from app.engine import analyze, recognize_faces
from app.store import FaceStore
from benchmark.metrics import score_image, summarize


def _enroll(store: FaceStore, students: dict[str, dict[str, Path]], cohort: list[str], poses: tuple[str, ...]) -> None:
    for student_id in cohort:
        samples = []
        for pose in poses:
            image = cv2.imread(str(students[student_id][pose]))
            if image is None:
                raise RuntimeError(f"Não foi possível ler {students[student_id][pose]}")
            assessment, _, _ = analyze(image, pose, enrollment=True)
            if not assessment.ok or assessment.embedding is None:
                raise RuntimeError(f"Enrollment recusado para {student_id} ({pose}): {assessment.code}")
            samples.append(
                {
                    "pose": pose,
                    "embedding": np.asarray(assessment.embedding, dtype=np.float32),
                    "detScore": assessment.det_score,
                    "yaw": assessment.yaw,
                    "quality": assessment.quality,
                }
            )
        store.replace(student_id, samples)


def _recognize(store: FaceStore, image: np.ndarray, roster: list[str]) -> tuple[list[dict], int]:
    started = time.perf_counter()
    rows = store.embeddings(roster)
    by_student: dict[str, list[tuple[str, np.ndarray]]] = {}
    for student_id, pose, vector in rows:
        by_student.setdefault(student_id, []).append((pose, vector))
    faces = []
    for assessment, box in recognize_faces(image):
        scores = []
        for student_id, samples in by_student.items():
            pose, score = max(
                ((pose, float(np.dot(assessment.embedding, vector))) for pose, vector in samples),
                key=lambda item: item[1],
            )
            scores.append((student_id, score, pose))
        decision = rank_students(scores)
        faces.append({**decision, "box": box})
    elapsed = int((time.perf_counter() - started) * 1000)
    enrolled = {student_id for student_id, _pose, _vector in rows}
    assembled = assemble_roll(roster, faces, enrolled)
    return assembled["faces"], elapsed


def score_dataset(students, cohort, usable, poses: tuple[str, ...]) -> dict:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        store = FaceStore(Path(tmp) / "faces.sqlite")
        _enroll(store, students, cohort, poses)
        image_reports = []
        for item in usable:
            if item.get("excluded"):
                continue
            spec = item["spec"]
            roster = list(spec.get("candidateStudentIds") or [])
            image = cv2.imread(str(item["probe"]))
            if image is None:
                image_reports.append({"id": item["id"], "excluded": True, "reason": "imagem ilegível"})
                continue
            faces, elapsed = _recognize(store, image, roster)
            scored = score_image(roster, spec.get("faces") or [], faces)
            image_reports.append(
                {
                    "id": item["id"],
                    "excluded": False,
                    "elapsedMs": elapsed,
                    "detectedFaces": len(faces),
                    "rosterSize": len(roster),
                    **scored,
                }
            )
    return {"summary": summarize(image_reports), "images": image_reports}
