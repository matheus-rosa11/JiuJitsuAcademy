"""Scores for a class photo. Precision is not accuracy, and an empty set is not 100%."""

from __future__ import annotations

IOU_MIN = 0.5
# Below this, a report can still show counts, but it does not answer the academy question.
CLAIM_MIN_IMAGES = 5
CLAIM_MIN_IDENTIFIABLE = 30


def ratio(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


def f1(precision: float | None, recall: float | None) -> float | None:
    if precision is None or recall is None:
        return None
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def iou(first: list[float], second: list[float]) -> float:
    ax1, ay1, ax2, ay2 = first
    bx1, by1, bx2, by2 = second
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter == 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union else 0.0


def _pair(gt_faces: list[dict], pred_faces: list[dict]) -> dict[int, int]:
    pairs = []
    for gt_index, gt_face in enumerate(gt_faces):
        box = gt_face.get("box")
        if not box:
            continue
        for pred_index, pred_face in enumerate(pred_faces):
            pred_box = pred_face.get("box")
            if not pred_box:
                continue
            overlap = iou(box, pred_box)
            if overlap >= IOU_MIN:
                pairs.append((overlap, gt_index, pred_index))
    pairs.sort(reverse=True)
    used_gt: set[int] = set()
    used_pred: set[int] = set()
    matching: dict[int, int] = {}
    for _overlap, gt_index, pred_index in pairs:
        if gt_index in used_gt or pred_index in used_pred:
            continue
        used_gt.add(gt_index)
        used_pred.add(pred_index)
        matching[gt_index] = pred_index
    return matching


def _counts(tp: int, fp: int, fn: int) -> dict:
    precision = ratio(tp, tp + fp)
    recall = ratio(tp, tp + fn)
    return {
        "truePositives": tp,
        "falsePositives": fp,
        "falseNegatives": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1(precision, recall),
    }


def score_image(roster: list[str], gt_faces: list[dict], pred_faces: list[dict]) -> dict:
    """Score one photograph.

    An automatic identification is only a face whose role is ``suggested``.
    Review is manual work: it is not a true positive and not a false positive.
    A known, identifiable person who was not automatically confirmed is a false
    negative, whether the detector missed them or the match was unsure or wrong.
    Someone on the roster who is not identifiable in this photo is pending, not
    a false negative.
    """
    identifiable = [face for face in gt_faces if face.get("identifiable") and face.get("studentId")]
    boxes_ready = all(face.get("box") for face in identifiable) and all(face.get("box") for face in pred_faces)
    suggested = [face for face in pred_faces if face.get("role") == "suggested" and face.get("studentId")]
    review_faces = [face for face in pred_faces if face.get("role") == "review"]
    detection_misses = None
    level = "identity-set"

    if boxes_ready:
        level = "face"
        matching = _pair(gt_faces, pred_faces)
        tp = fp = fn = 0
        detection_misses = 0
        for index, gt_face in enumerate(gt_faces):
            if not (gt_face.get("identifiable") and gt_face.get("studentId")):
                continue
            pred_index = matching.get(index)
            if pred_index is None:
                detection_misses += 1
                fn += 1
                continue
            pred = pred_faces[pred_index]
            if pred.get("role") == "suggested" and pred.get("studentId") == gt_face.get("studentId"):
                tp += 1
            else:
                fn += 1
        for index, pred in enumerate(pred_faces):
            if pred.get("role") != "suggested" or not pred.get("studentId"):
                continue
            gt_index = next((key for key, value in matching.items() if value == index), None)
            if gt_index is None or gt_faces[gt_index].get("studentId") != pred.get("studentId"):
                fp += 1
        correct_ids = {
            pred_faces[pred_index]["studentId"]
            for gt_index, pred_index in matching.items()
            if pred_faces[pred_index].get("role") == "suggested"
            and pred_faces[pred_index].get("studentId") == gt_faces[gt_index].get("studentId")
        }
    else:
        truth = {face["studentId"] for face in identifiable}
        automatic = {face["studentId"] for face in suggested}
        tp = len(truth & automatic)
        fp = len(automatic - truth)
        fn = len(truth - automatic)
        correct_ids = truth & automatic

    review_ids = {face["studentId"] for face in review_faces if face.get("studentId")}
    suggested_ids = {face["studentId"] for face in suggested}
    pending = [student_id for student_id in roster if student_id not in suggested_ids and student_id not in review_ids]
    identifiable_ids = {face["studentId"] for face in identifiable}
    counts = _counts(tp, fp, fn)
    return {
        "level": level,
        **counts,
        "detectionMisses": detection_misses,
        "detectionSplit": level == "face",
        "reviewFaces": len(review_faces),
        "reviewRate": ratio(len(review_faces), len(pred_faces)),
        "automaticAssignments": len(suggested),
        "wrongIdentificationRate": ratio(fp, tp + fp),
        "identifiablePeople": len(identifiable),
        "correctStudents": len(correct_ids & identifiable_ids),
        "correctStudentRate": ratio(len(correct_ids & identifiable_ids), len(identifiable_ids)),
        "pendingStudents": len(pending),
        "pendingRate": ratio(len(pending), len(roster)),
    }


def summarize(images: list[dict]) -> dict:
    scored = [image for image in images if not image.get("excluded")]
    tp = sum(image["truePositives"] for image in scored)
    fp = sum(image["falsePositives"] for image in scored)
    fn = sum(image["falseNegatives"] for image in scored)
    counts = _counts(tp, fp, fn)
    identifiable = sum(image["identifiablePeople"] for image in scored)
    correct_students = sum(image["correctStudents"] for image in scored)
    review_faces = sum(image["reviewFaces"] for image in scored)
    detected = sum(image["detectedFaces"] for image in scored)
    pending = sum(image["pendingStudents"] for image in scored)
    roster = sum(image["rosterSize"] for image in scored)
    elapsed = [image["elapsedMs"] for image in scored if image.get("elapsedMs") is not None]
    status = "observed" if len(scored) >= CLAIM_MIN_IMAGES and identifiable >= CLAIM_MIN_IDENTIFIABLE else "incomplete"
    return {
        "status": status,
        "imagesScored": len(scored),
        "imagesExcluded": len(images) - len(scored),
        "identifiablePeople": identifiable,
        **counts,
        "detectionMisses": None
        if any(image.get("detectionMisses") is None for image in scored)
        else sum(image["detectionMisses"] for image in scored),
        "reviewFaces": review_faces,
        "reviewRate": ratio(review_faces, detected),
        "correctStudentRate": ratio(correct_students, identifiable),
        "wrongIdentificationRate": ratio(fp, tp + fp),
        "pendingStudents": pending,
        "pendingRate": ratio(pending, roster),
        "elapsedMsTotal": None if not elapsed else sum(elapsed),
        "elapsedMsMean": None if not elapsed else sum(elapsed) / len(elapsed),
        "claim": "Amostra pequena demais para responder quantos alunos uma foto real de treino acerta."
        if status == "incomplete"
        else "Contagens observadas neste conjunto. Não é uma garantia para outras academias.",
    }
