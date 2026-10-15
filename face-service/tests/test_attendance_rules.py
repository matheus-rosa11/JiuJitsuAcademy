"""Roll-call suggestions. A face the photo missed is pending, never absent."""

from app.attendance import assemble_roll


def _face(decision, student_id, score=0.9, box=None, ambiguous=False):
    return {
        "decision": decision,
        "studentId": student_id,
        "score": score,
        "box": box if box is not None else [0, 0, 10, 10],
        "ambiguous": ambiguous,
        "matchedPose": None if decision == "UNKNOWN" else "front",
        "candidates": [],
    }


def test_a_single_confident_face_is_suggested_and_a_missing_classmate_stays_pending():
    roll = assemble_roll(
        ["ana", "bruno"],
        [
            _face("MATCHED", "ana", box=[0, 0, 10, 10]),
            _face("UNKNOWN", None, score=0.08, box=[20, 0, 30, 10]),
        ],
        {"ana", "bruno"},
    )
    assert roll["faces"][0]["role"] == "suggested"
    assert roll["faces"][1]["role"] == "unknown"
    assert roll["faces"][1]["studentId"] is None
    by_id = {item["studentId"]: item for item in roll["students"]}
    assert by_id["ana"]["status"] == "suggested"
    assert by_id["ana"]["reason"] == "matched"
    assert by_id["bruno"]["status"] == "pending"
    assert by_id["bruno"]["reason"] == "not_seen"
    assert roll["counts"]["unknownFaces"] == 1
    assert all(item["status"] != "absent" for item in roll["students"])


def test_two_faces_for_the_same_student_go_to_review():
    roll = assemble_roll(
        ["ana", "bia"],
        [
            _face("MATCHED", "ana", score=0.91, box=[0, 0, 10, 10]),
            _face("MATCHED", "ana", score=0.88, box=[30, 0, 40, 10]),
        ],
        {"ana"},
    )
    assert [face["role"] for face in roll["faces"]] == ["review", "review"]
    by_id = {item["studentId"]: item for item in roll["students"]}
    assert by_id["ana"]["status"] == "review"
    assert by_id["ana"]["reason"] == "needs_review"
    assert by_id["bia"]["status"] == "pending"
    assert by_id["bia"]["reason"] == "no_profile"


def test_an_unsure_match_is_review_and_an_empty_roster_names_nobody():
    review = assemble_roll(["ana"], [_face("REVIEW", "ana", score=0.35)], {"ana"})
    assert review["faces"][0]["role"] == "review"
    assert review["students"][0]["status"] == "review"

    empty = assemble_roll([], [_face("UNKNOWN", None, score=None)], set())
    assert empty["students"] == []
    assert empty["faces"][0]["role"] == "unknown"
    assert empty["faces"][0]["studentId"] is None


def test_an_off_roster_professor_is_named_without_joining_the_roll():
    roll = assemble_roll(
        ["ana"],
        [
            _face("MATCHED", "giba", box=[0, 0, 10, 10]),
            _face("MATCHED", "ana", box=[20, 0, 30, 10]),
            _face("UNKNOWN", None, score=0.1, box=[40, 0, 50, 10]),
        ],
        {"ana", "giba"},
        ["giba"],
    )
    assert roll["faces"][0]["role"] == "instructor"
    assert roll["faces"][0]["studentId"] == "giba"
    assert roll["faces"][1]["role"] == "suggested"
    assert [item["studentId"] for item in roll["students"]] == ["ana"]
    assert roll["counts"]["unknownFaces"] == 1
    assert roll["counts"]["suggested"] == 1


def test_a_professor_who_is_on_the_roster_stays_a_student():
    roll = assemble_roll(
        ["felipe"],
        [_face("MATCHED", "felipe")],
        {"felipe"},
        ["felipe"],
    )
    assert roll["faces"][0]["role"] == "suggested"
    assert roll["students"][0]["status"] == "suggested"


def test_an_unsure_professor_is_not_named():
    face = _face("REVIEW", "giba", score=0.34, ambiguous=True)
    face["candidates"] = [{"studentId": "giba", "decision": "REVIEW"}, {"studentId": "ana", "decision": "REVIEW"}]
    roll = assemble_roll(["ana"], [face], {"giba", "ana"}, ["giba"])
    assert roll["faces"][0]["role"] == "unknown"
    assert roll["faces"][0]["studentId"] is None
    assert roll["faces"][0]["candidates"][1]["studentId"] == "ana"
    assert roll["counts"]["unknownFaces"] == 1
    assert all(item["studentId"] != "giba" for item in roll["students"])
