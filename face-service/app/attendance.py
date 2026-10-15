"""Turn face decisions into a roll-call suggestion.

A missing face is not an absence. Someone can be in class and still be out of
frame, turned away, or too small to recognize. Only the professor confirms
who was absent.
"""

from __future__ import annotations


def assemble_roll(
    candidate_ids: list[str],
    faces: list[dict],
    enrolled_ids: set[str],
    instructor_ids: list[str] | None = None,
) -> dict:
    ordered: list[str] = []
    for student_id in candidate_ids:
        if student_id not in ordered:
            ordered.append(student_id)
    roster = set(ordered)
    instructor_only = {student_id for student_id in (instructor_ids or []) if student_id not in roster}

    claims: dict[str, list[int]] = {}
    for index, face in enumerate(faces):
        student_id = face.get("studentId")
        if face.get("decision") == "UNKNOWN" or not student_id:
            continue
        claims.setdefault(student_id, []).append(index)
    conflicted = {student_id for student_id, indexes in claims.items() if len(indexes) > 1}

    annotated = []
    for index, face in enumerate(faces):
        student_id = face.get("studentId")
        decision = face.get("decision")
        off_roster_instructor = student_id in instructor_only
        confident_instructor = (
            off_roster_instructor
            and decision == "MATCHED"
            and student_id not in conflicted
            and not face.get("ambiguous")
        )
        if decision == "UNKNOWN" or not student_id:
            role = "unknown"
            student_id = None
        elif confident_instructor:
            role = "instructor"
        elif off_roster_instructor:
            # An unsure professor is not named and does not become an attendance row.
            role = "unknown"
            student_id = None
        elif student_id in conflicted or decision == "REVIEW" or face.get("ambiguous"):
            role = "review"
        elif decision == "MATCHED":
            role = "suggested"
        else:
            role = "unknown"
            student_id = None
        annotated.append(
            {
                "index": index,
                "box": face.get("box"),
                "role": role,
                "studentId": student_id,
                "score": face.get("score"),
                "matchedPose": face.get("matchedPose") if student_id else None,
                "ambiguous": bool(face.get("ambiguous")),
                "candidates": face.get("candidates") or [],
            }
        )

    by_student: dict[str, dict] = {}
    for item in annotated:
        if item["studentId"] and item["studentId"] not in by_student:
            by_student[item["studentId"]] = item

    students = []
    for student_id in ordered:
        linked = by_student.get(student_id)
        if linked and linked["role"] == "suggested":
            status, reason = "suggested", "matched"
        elif linked and linked["role"] == "review":
            status, reason = "review", "needs_review"
        elif student_id not in enrolled_ids:
            status, reason = "pending", "no_profile"
        else:
            status, reason = "pending", "not_seen"
        students.append(
            {
                "studentId": student_id,
                "status": status,
                "reason": reason,
                "faceIndex": None if linked is None else linked["index"],
                "score": None if linked is None else linked["score"],
            }
        )

    return {
        "faces": annotated,
        "students": students,
        "counts": {
            "suggested": sum(1 for item in students if item["status"] == "suggested"),
            "review": sum(1 for item in students if item["status"] == "review"),
            "pending": sum(1 for item in students if item["status"] == "pending"),
            "unknownFaces": sum(1 for item in annotated if item["role"] == "unknown"),
        },
    }
