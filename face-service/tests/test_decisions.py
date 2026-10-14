from app.decisions import AMBIGUITY_MARGIN, MATCHED_MIN, rank_students


def test_unknown_when_nobody_is_enrolled():
    assert rank_students([])["decision"] == "UNKNOWN"
    assert rank_students([])["studentId"] is None


def test_high_score_is_a_match():
    result = rank_students([("ana", 0.94, "front")])
    assert result["decision"] == "MATCHED"
    assert result["studentId"] == "ana"
    assert result["matchedPose"] == "front"


def test_middle_score_is_review():
    result = rank_students([("ana", (MATCHED_MIN + 0.30) / 2, "left")])
    assert result["decision"] == "REVIEW"
    assert result["studentId"] == "ana"


def test_low_score_is_unknown_and_hides_the_student():
    result = rank_students([("ana", 0.05, "front"), ("bia", 0.02, "right")])
    assert result["decision"] == "UNKNOWN"
    assert result["studentId"] is None


def test_two_close_matches_are_not_automatic():
    top = 0.80
    result = rank_students([("ana", top, "front"), ("bia", top - AMBIGUITY_MARGIN / 2, "front")])
    assert result["decision"] == "REVIEW"
    assert result["ambiguous"] is True
    assert result["studentId"] == "ana"
