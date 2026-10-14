import base64
from pathlib import Path

import cv2
import numpy as np
import pytest

import insightface
from insightface.app import FaceAnalysis


@pytest.fixture(scope="session")
def runtime():
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    return app


@pytest.fixture(scope="session")
def group_photo():
    photo = Path(insightface.__file__).parent / "data" / "images" / "t1.jpg"
    image = cv2.imread(str(photo))
    assert image is not None
    return image


def crop_face(image: np.ndarray, box, flip: bool = False) -> np.ndarray:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = [int(round(v)) for v in box]
    pad = int(0.85 * max(x2 - x1, y2 - y1))
    xa, ya = max(0, x1 - pad), max(0, y1 - pad)
    xb, yb = min(width, x2 + pad), min(height, y2 + pad)
    crop = image[ya:yb, xa:xb]
    if flip:
        crop = cv2.flip(crop, 1)
    return cv2.resize(crop, (720, int(round(720 * crop.shape[0] / crop.shape[1]))))


def jpeg_b64(image: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    assert ok
    return base64.b64encode(encoded.tobytes()).decode("ascii")


@pytest.fixture(scope="session")
def pose_images(runtime, group_photo):
    faces = runtime.get(group_photo)
    front = min(faces, key=lambda face: abs(float(face.pose[1])))
    turned = min(
        (face for face in faces if float(face.pose[1]) <= -18),
        key=lambda face: abs(float(face.pose[1]) + 20),
    )
    # "other" must be a person who is not stored in the enrolled profile.
    # front and the turned face (and its mirror) are different people already;
    # using the turned crop here would MATCH the right embedding.
    other = min(
        (face for face in faces if face is not front and face is not turned),
        key=lambda face: abs(float(face.pose[1])),
    )
    return {
        "front": crop_face(group_photo, front.bbox, False),
        "right": crop_face(group_photo, turned.bbox, False),
        "left": crop_face(group_photo, turned.bbox, True),
        "other": crop_face(group_photo, other.bbox, False),
        "group": group_photo,
    }
