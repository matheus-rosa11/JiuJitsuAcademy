import os
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import get_store
from tests.conftest import jpeg_b64


@pytest.fixture()
def client(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("FACE_DB", str(tmp_path / "faces.sqlite"))
    # Drop a store cached against another path.
    import app.main as main

    main._store = None
    with TestClient(main.app) as test_client:
        yield test_client
    main._store = None


def test_front_crop_passes_and_a_frontal_photo_is_not_a_side_view(client, pose_images):
    front = jpeg_b64(pose_images["front"])
    ok = client.post("/faces/check", json={"pose": "front", "imageBase64": front})
    assert ok.status_code == 200, ok.text
    assert ok.json()["quality"]["yaw"] == pytest.approx(0, abs=12)

    rejected = client.post("/faces/check", json={"pose": "left", "imageBase64": front})
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "not_left"
    assert "esquerda" in rejected.json()["message"]


def test_side_crops_are_accepted_only_for_their_direction(client, pose_images):
    right = client.post("/faces/check", json={"pose": "right", "imageBase64": jpeg_b64(pose_images["right"])})
    left = client.post("/faces/check", json={"pose": "left", "imageBase64": jpeg_b64(pose_images["left"])})
    assert right.status_code == 200, right.text
    assert left.status_code == 200, left.text
    assert right.json()["quality"]["yaw"] < 0
    assert left.json()["quality"]["yaw"] > 0


def test_enroll_replaces_and_delete_removes(client, pose_images):
    body = {
        "studentId": "aluno-1",
        "captures": [
            {"pose": pose, "imageBase64": jpeg_b64(pose_images[pose])} for pose in ("front", "left", "right")
        ],
    }
    created = client.post("/faces/enroll", json=body)
    assert created.status_code == 201, created.text
    assert sorted(item["pose"] for item in created.json()["captures"]) == ["front", "left", "right"]

    profile = client.get("/faces/aluno-1", params={"embeddings": True})
    assert profile.status_code == 200
    payload = profile.json()
    assert payload["poses"] == ["front", "left", "right"] or sorted(payload["poses"]) == ["front", "left", "right"]
    front = next(item for item in payload["captures"] if item["pose"] == "front")
    assert front["embeddingDimensions"] == 512
    assert len(front["embedding"]) == 512
    assert front["embeddingNorm"] == pytest.approx(1, abs=0.02)

    again = client.post("/faces/enroll", json=body)
    assert again.status_code == 201

    removed = client.delete("/faces/aluno-1")
    assert removed.status_code == 204
    assert client.get("/faces/aluno-1").status_code == 404


def test_same_face_matches_and_a_different_face_does_not(client, pose_images):
    client.post(
        "/faces/enroll",
        json={
            "studentId": "aluno-frente",
            "captures": [
                {"pose": pose, "imageBase64": jpeg_b64(pose_images[pose])} for pose in ("front", "left", "right")
            ],
        },
    )
    same = client.post("/faces/recognize", json={"imageBase64": jpeg_b64(pose_images["front"])})
    assert same.status_code == 200, same.text
    face = same.json()["faces"][0]
    assert face["decision"] == "MATCHED"
    assert face["studentId"] == "aluno-frente"
    assert face["score"] >= 0.4

    other = client.post(
        "/faces/recognize",
        json={
            "imageBase64": jpeg_b64(pose_images["other"]),
            "candidateStudentIds": ["aluno-frente"],
        },
    )
    assert other.json()["faces"][0]["decision"] == "UNKNOWN"
    assert other.json()["faces"][0]["studentId"] is None


def test_a_heavy_blur_is_not_accepted(client, pose_images):
    blurred = cv2.GaussianBlur(pose_images["front"], (21, 21), 0)
    response = client.post("/faces/check", json={"pose": "front", "imageBase64": jpeg_b64(blurred)})
    assert response.status_code == 422
    assert response.json()["code"] == "blurry"


def test_blank_frame_has_no_face(client):
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    response = client.post("/faces/check", json={"pose": "front", "imageBase64": jpeg_b64(blank)})
    assert response.status_code == 422
    assert response.json()["code"] == "no_face"


def test_demo_samples_and_a_group_photo_keep_strangers_unknown(client, pose_images):
    samples = client.get("/faces/demo/samples")
    assert samples.status_code == 200, samples.text
    body = samples.json()
    for key in ("front", "left", "right", "group"):
        assert body[key].startswith("data:image/jpeg")

    client.post(
        "/faces/enroll",
        json={
            "studentId": "aluno-frente",
            "captures": [
                {"pose": pose, "imageBase64": jpeg_b64(pose_images[pose])} for pose in ("front", "left", "right")
            ],
        },
    )
    response = client.post(
        "/faces/recognize",
        json={"imageBase64": jpeg_b64(pose_images["group"]), "candidateStudentIds": ["aluno-frente"]},
    )
    assert response.status_code == 200, response.text
    faces = response.json()["faces"]
    assert len(faces) >= 4
    decisions = {face["decision"] for face in faces}
    assert "MATCHED" in decisions
    assert "UNKNOWN" in decisions
    assert all(face["studentId"] in (None, "aluno-frente") for face in faces)


def test_restricting_candidates_to_an_empty_class_matches_nobody(client, pose_images):
    client.post(
        "/faces/enroll",
        json={
            "studentId": "aluno-frente",
            "captures": [
                {"pose": pose, "imageBase64": jpeg_b64(pose_images[pose])} for pose in ("front", "left", "right")
            ],
        },
    )
    response = client.post(
        "/faces/recognize",
        json={"imageBase64": jpeg_b64(pose_images["front"]), "candidateStudentIds": []},
    )
    assert response.json()["faces"][0]["decision"] == "UNKNOWN"
