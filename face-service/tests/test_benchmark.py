"""Metric formulas. These tests use no photographs and do not claim an academy result."""

import json
import sys
from pathlib import Path

from benchmark.metrics import score_image, summarize
from benchmark.run import evaluate


def test_a_correct_automatic_id_does_not_turn_unseen_classmates_into_false_negatives():
    scored = score_image(
        ["ana", "bruno", "carla"],
        [
            {"studentId": "ana", "identifiable": True, "box": [0, 0, 10, 10]},
            {"studentId": None, "identifiable": False, "box": [40, 0, 50, 10]},
            {"studentId": "bruno", "identifiable": False},
        ],
        [
            {"role": "suggested", "studentId": "ana", "box": [0, 0, 10, 10]},
            {"role": "unknown", "studentId": None, "box": [40, 0, 50, 10]},
        ],
    )
    assert scored["level"] == "face"
    assert scored["truePositives"] == 1
    assert scored["falsePositives"] == 0
    assert scored["falseNegatives"] == 0
    assert scored["detectionMisses"] == 0
    assert scored["precision"] == 1
    assert scored["recall"] == 1
    assert scored["pendingStudents"] == 2
    assert scored["correctStudentRate"] == 1


def test_a_wrong_name_on_a_detected_face_is_a_false_positive_and_a_false_negative():
    scored = score_image(
        ["ana", "carla"],
        [{"studentId": "ana", "identifiable": True, "box": [0, 0, 10, 10]}],
        [{"role": "suggested", "studentId": "carla", "box": [0, 0, 10, 10]}],
    )
    assert scored["truePositives"] == 0
    assert scored["falsePositives"] == 1
    assert scored["falseNegatives"] == 1
    assert scored["detectionMisses"] == 0
    assert scored["precision"] == 0
    assert scored["recall"] == 0
    assert scored["f1"] == 0


def test_a_known_face_the_detector_missed_is_split_from_an_identification_error():
    scored = score_image(
        ["ana", "carla"],
        [{"studentId": "ana", "identifiable": True, "box": [0, 0, 10, 10]}],
        [{"role": "suggested", "studentId": "carla", "box": [80, 0, 90, 10]}],
    )
    assert scored["detectionMisses"] == 1
    assert scored["falseNegatives"] == 1
    assert scored["falsePositives"] == 1


def test_no_predictions_and_no_identifiable_people_are_not_perfect_scores():
    scored = score_image(["ana"], [], [])
    assert scored["precision"] is None
    assert scored["recall"] is None
    assert scored["f1"] is None
    assert scored["correctStudentRate"] is None
    assert scored["pendingRate"] == 1


def test_review_of_the_right_person_is_a_miss_not_a_wrong_id():
    scored = score_image(
        ["ana"],
        [{"studentId": "ana", "identifiable": True, "box": [0, 0, 10, 10]}],
        [{"role": "review", "studentId": "ana", "box": [1, 1, 9, 9]}],
    )
    assert scored["truePositives"] == 0
    assert scored["falsePositives"] == 0
    assert scored["falseNegatives"] == 1
    assert scored["precision"] is None
    assert scored["recall"] == 0
    assert scored["f1"] is None
    assert scored["reviewFaces"] == 1
    assert scored["automaticAssignments"] == 0


def _report(**overrides):
    base = {
        "excluded": False,
        "truePositives": 1,
        "falsePositives": 0,
        "falseNegatives": 0,
        "identifiablePeople": 1,
        "correctStudents": 1,
        "reviewFaces": 0,
        "detectedFaces": 1,
        "pendingStudents": 0,
        "rosterSize": 1,
        "elapsedMs": 100,
        "detectionMisses": 0,
    }
    base.update(overrides)
    return base


def test_a_small_set_stays_incomplete_even_when_every_count_is_right():
    small = summarize([_report() for _ in range(4)])
    assert small["status"] == "incomplete"
    assert small["precision"] == 1
    assert "pequena demais" in small["claim"]

    enough_images = [_report(identifiablePeople=30, correctStudents=30)] + [_report(identifiablePeople=0, correctStudents=0, truePositives=0) for _ in range(4)]
    assert summarize(enough_images)["status"] == "observed"


def test_a_missing_dataset_does_not_load_the_recognizer(tmp_path):
    sys.modules.pop("benchmark.execute", None)
    report = evaluate(tmp_path / "does-not-exist")
    assert report["status"] == "incomplete"
    assert report["metrics"] is None
    assert "benchmark.execute" not in sys.modules


def test_the_same_file_in_enrollment_and_in_the_probe_is_leakage(tmp_path):
    dataset = tmp_path / "dataset"
    student = dataset / "enrollment" / "ana"
    student.mkdir(parents=True)
    (dataset / "images").mkdir()
    (student / "front.jpg").write_bytes(b"same-bytes")
    (student / "left.jpg").write_bytes(b"left")
    (student / "right.jpg").write_bytes(b"right")
    (dataset / "images" / "class.jpg").write_bytes(b"same-bytes")
    (dataset / "manifest.json").write_text(
        json.dumps(
            {
                "images": [
                    {
                        "id": "class",
                        "file": "images/class.jpg",
                        "candidateStudentIds": ["ana"],
                        "faces": [],
                    }
                ]
            }
        )
    )
    sys.modules.pop("benchmark.execute", None)
    report = evaluate(dataset)
    assert report["status"] == "incomplete"
    assert report["leaked"] == ["class"]
    assert "benchmark.execute" not in sys.modules
