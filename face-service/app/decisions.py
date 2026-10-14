"""Match scores to the decisions the academy app is allowed to act on.

Embeddings are L2-normalized ArcFace vectors, so cosine similarity is a dot product.
Each student keeps one embedding per pose. The score against a student is the best
pose, not an average: averaging a frontal vector with a turned one blurs both.
"""

from __future__ import annotations

MATCHED_MIN = 0.40
REVIEW_MIN = 0.30
# Two students this close are not safe to call a match.
AMBIGUITY_MARGIN = 0.06


def decide(score: float) -> str:
    if score >= MATCHED_MIN:
        return "MATCHED"
    if score >= REVIEW_MIN:
        return "REVIEW"
    return "UNKNOWN"


def rank_students(scores: list[tuple[str, float, str]]) -> dict:
    """scores items are (student_id, best_cosine, pose_that_won)."""
    if not scores:
        return {
            "decision": "UNKNOWN",
            "studentId": None,
            "score": None,
            "matchedPose": None,
            "ambiguous": False,
            "candidates": [],
        }

    ranked = sorted(scores, key=lambda item: item[1], reverse=True)
    best_id, best_score, best_pose = ranked[0]
    decision = decide(best_score)
    ambiguous = False
    if len(ranked) > 1 and decision == "MATCHED" and best_score - ranked[1][1] < AMBIGUITY_MARGIN:
        decision = "REVIEW"
        ambiguous = True

    return {
        "decision": decision,
        "studentId": None if decision == "UNKNOWN" else best_id,
        "score": round(float(best_score), 4),
        "matchedPose": None if decision == "UNKNOWN" else best_pose,
        "ambiguous": ambiguous,
        "candidates": [
            {
                "studentId": student_id,
                "score": round(float(score), 4),
                "decision": decide(score),
                "matchedPose": pose,
            }
            for student_id, score, pose in ranked[:5]
        ],
    }
