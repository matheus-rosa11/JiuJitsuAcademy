"""Developer fixtures taken from the InsightFace sample photo.

These are not academy students. They only exist so the guided flow and the
recognition endpoint can be exercised on a machine without a webcam.

The frontal crop and the turned crop are different people. The left image is a
horizontal flip of the turned crop, so a profile enrolled from these three
samples mixes two identities. That is enough to exercise pose gates and
matching; it is not a same-person robustness study.
"""

from __future__ import annotations

import threading
from pathlib import Path

import cv2
import numpy as np

from .engine import detect
from .images import to_data_url

_lock = threading.Lock()
_cache: dict[str, str] | None = None


def _crop(image: np.ndarray, box: np.ndarray, flip: bool) -> np.ndarray:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = [int(round(v)) for v in box]
    pad = int(0.85 * max(x2 - x1, y2 - y1))
    xa, ya = max(0, x1 - pad), max(0, y1 - pad)
    xb, yb = min(width, x2 + pad), min(height, y2 + pad)
    crop = image[ya:yb, xa:xb]
    if flip:
        crop = cv2.flip(crop, 1)
    return cv2.resize(crop, (720, int(round(720 * crop.shape[0] / crop.shape[1]))))


def build_demo_samples() -> dict[str, str]:
    global _cache
    with _lock:
        if _cache is not None:
            return _cache
        import insightface

        photo = Path(insightface.__file__).parent / "data" / "images" / "t1.jpg"
        if not photo.exists():
            raise FileNotFoundError(photo)
        image = cv2.imread(str(photo))
        faces = detect(image)
        front = min(faces, key=lambda face: abs(float(face.pose[1])))
        turned = min(
            (face for face in faces if float(face.pose[1]) <= -18),
            key=lambda face: abs(float(face.pose[1]) + 20),
        )
        samples = {
            "front": _crop(image, front.bbox, False),
            "right": _crop(image, turned.bbox, False),
            "left": _crop(image, turned.bbox, True),
            "group": image,
        }
        _cache = {name: to_data_url(frame) for name, frame in samples.items()}
        return _cache
