"""Decode enrollment frames and keep them in a size the detector can use."""

from __future__ import annotations

import base64

import cv2
import numpy as np

MAX_BASE64_CHARS = 12_000_000
MAX_SIDE = 1600
MIN_SIDE = 480


class ImageError(ValueError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def decode_image(image_base64: str) -> np.ndarray:
    payload = image_base64.strip()
    if len(payload) > MAX_BASE64_CHARS:
        raise ImageError("bad_image")
    if payload.startswith("data:"):
        payload = payload.split(",", 1)[1]
    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception as exc:
        raise ImageError("bad_image") from exc
    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise ImageError("bad_image")
    return image


def fit_image(image: np.ndarray) -> tuple[np.ndarray, float]:
    """Return an image the detector can see, and the scale applied to the original."""
    height, width = image.shape[:2]
    scale = 1.0
    long_side = max(height, width)
    short_side = min(height, width)
    if long_side > MAX_SIDE:
        scale = MAX_SIDE / long_side
    elif short_side < MIN_SIDE:
        scale = MIN_SIDE / short_side
    if scale != 1.0:
        image = cv2.resize(image, (int(round(width * scale)), int(round(height * scale))))
    return image, scale


def jpeg_bytes(image: np.ndarray, quality: int = 90) -> bytes:
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ImageError("bad_image")
    return encoded.tobytes()


def to_data_url(image: np.ndarray) -> str:
    encoded = base64.b64encode(jpeg_bytes(image)).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"
