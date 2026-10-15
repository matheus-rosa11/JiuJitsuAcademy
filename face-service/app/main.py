"""HTTP contract for facial enrollment and class-photo recognition.

The academy system should call these routes. It should not run its own face model.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from .attendance import assemble_roll
from .decisions import rank_students
from .engine import analyze, recognize_faces
from .geometry import POSES
from .images import ImageError, decode_image
from .messages import message_for
from .samples import build_demo_samples
from .store import FaceStore

ROOT = Path(__file__).resolve().parents[1]
_store: FaceStore | None = None


def get_store() -> FaceStore:
    global _store
    path = Path(os.environ.get("FACE_DB", ROOT / "data" / "faces.sqlite"))
    if _store is None or _store.path != path:
        _store = FaceStore(path)
    return _store


app = FastAPI(title="Tatame Face Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
def http_error(_request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=detail)


class CaptureIn(BaseModel):
    pose: str
    imageBase64: str = Field(min_length=20)


class CheckIn(BaseModel):
    pose: str
    imageBase64: str = Field(min_length=20)


class EnrollIn(BaseModel):
    studentId: str = Field(min_length=1, max_length=80)
    captures: list[CaptureIn]


class RecognizeIn(BaseModel):
    imageBase64: str = Field(min_length=20)
    candidateStudentIds: list[str] | None = None


class AttendanceIn(BaseModel):
    imageBase64: str = Field(min_length=20)
    candidateStudentIds: list[str]
    instructorStudentIds: list[str] = []


def _student_id(value: str) -> str:
    student_id = value.strip()
    if not student_id or "/" in student_id or len(student_id) > 80:
        raise HTTPException(status_code=422, detail={"message": "Aluno inválido.", "code": "bad_student"})
    return student_id


def _pose(value: str) -> str:
    if value not in POSES:
        raise HTTPException(status_code=422, detail={"message": message_for("incomplete"), "code": "bad_pose"})
    return value


def _reject(assessment, pose: str) -> None:
    raise HTTPException(
        status_code=422,
        detail={"message": assessment.message, "code": assessment.code, "pose": pose},
    )


def _check(pose: str, image_base64: str):
    pose = _pose(pose)
    try:
        image = decode_image(image_base64)
    except ImageError as exc:
        raise HTTPException(status_code=422, detail={"message": message_for(exc.code), "code": exc.code, "pose": pose}) from exc
    assessment, _, _ = analyze(image, pose, enrollment=True)
    if not assessment.ok or assessment.embedding is None:
        _reject(assessment, pose)
    return assessment


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/faces/check")
def check_capture(body: CheckIn):
    assessment = _check(body.pose, body.imageBase64)
    return {"pose": body.pose, "accepted": True, "quality": assessment.quality}


@app.post("/faces/enroll", status_code=201)
def enroll(body: EnrollIn):
    student_id = _student_id(body.studentId)
    poses = [item.pose for item in body.captures]
    if sorted(poses) != sorted(POSES) or len(poses) != len(POSES):
        raise HTTPException(status_code=422, detail={"message": message_for("incomplete"), "code": "incomplete"})

    samples = []
    public = []
    for item in body.captures:
        assessment = _check(item.pose, item.imageBase64)
        samples.append(
            {
                "pose": item.pose,
                "embedding": assessment.embedding,
                "detScore": assessment.det_score,
                "yaw": assessment.yaw,
                "quality": assessment.quality,
            }
        )
        public.append(
            {
                "pose": item.pose,
                "accepted": True,
                "detScore": assessment.det_score,
                "yaw": assessment.yaw,
                "embeddingDimensions": 512,
                "quality": assessment.quality,
            }
        )

    updated = get_store().replace(student_id, samples)
    return {"studentId": student_id, "updatedAt": updated, "captures": public}


@app.delete("/faces/{student_id}", status_code=204)
def delete_profile(student_id: str):
    if not get_store().delete(_student_id(student_id)):
        raise HTTPException(status_code=404, detail={"message": "Este aluno não tem cadastro facial.", "code": "not_found"})
    return Response(status_code=204)


@app.get("/faces/demo/samples")
def demo_samples():
    try:
        return build_demo_samples()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"message": "Fotos de exemplo indisponíveis.", "code": "no_samples"}) from None


@app.get("/faces/{student_id}")
def get_profile(student_id: str, embeddings: bool = Query(default=False)):
    profile = get_store().get(_student_id(student_id), include_embeddings=embeddings)
    if profile is None:
        raise HTTPException(status_code=404, detail={"message": "Este aluno não tem cadastro facial.", "code": "not_found"})
    return profile


def _candidate_ids(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    ordered: list[str] = []
    for item in values:
        student_id = _student_id(item)
        if student_id not in ordered:
            ordered.append(student_id)
    return ordered


def _match(image: np.ndarray, candidate_ids: list[str] | None) -> tuple[list[dict], set[str]]:
    rows = get_store().embeddings(candidate_ids)
    by_student: dict[str, list[tuple[str, np.ndarray]]] = {}
    for student_id, pose, vector in rows:
        by_student.setdefault(student_id, []).append((pose, vector))
    enrolled = set(by_student)
    faces_out = []
    for assessment, box in recognize_faces(image):
        scores = []
        for student_id, samples in by_student.items():
            best_pose, best_score = max(
                ((pose, float(np.dot(assessment.embedding, vector))) for pose, vector in samples),
                key=lambda item: item[1],
            )
            scores.append((student_id, best_score, best_pose))
        decision = rank_students(scores)
        faces_out.append(
            {
                "box": box,
                "decision": decision["decision"],
                "studentId": decision["studentId"],
                "score": decision["score"],
                "matchedPose": decision["matchedPose"],
                "ambiguous": decision["ambiguous"],
                "candidates": decision["candidates"],
            }
        )
    return faces_out, enrolled


@app.post("/faces/recognize")
def recognize(body: RecognizeIn):
    try:
        image = decode_image(body.imageBase64)
    except ImageError as exc:
        raise HTTPException(status_code=422, detail={"message": message_for(exc.code), "code": exc.code}) from exc
    faces_out, _enrolled = _match(image, _candidate_ids(body.candidateStudentIds))
    return {"faces": faces_out}


@app.post("/faces/attendance")
def attendance(body: AttendanceIn):
    """Suggest presence for one class. Does not write attendance and does not imply absences."""
    started = time.perf_counter()
    try:
        image = decode_image(body.imageBase64)
    except ImageError as exc:
        raise HTTPException(status_code=422, detail={"message": message_for(exc.code), "code": exc.code}) from exc
    candidate_ids = _candidate_ids(body.candidateStudentIds) or []
    instructor_ids = _candidate_ids(body.instructorStudentIds) or []
    pool: list[str] = []
    for student_id in [*candidate_ids, *instructor_ids]:
        if student_id not in pool:
            pool.append(student_id)
    faces_out, enrolled = _match(image, pool)
    roll = assemble_roll(candidate_ids, faces_out, enrolled, instructor_ids)
    roll["elapsedMs"] = int((time.perf_counter() - started) * 1000)
    return roll
