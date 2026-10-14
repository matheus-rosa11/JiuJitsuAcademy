"""Head-pose gates for enrollment.

InsightFace buffalo_l exposes `pose` as pitch, yaw, roll in degrees. On this model,
yaw is negative when the subject turns to their right and positive when they turn
to their left. That sign was checked by horizontally flipping a turned face, which
flips the yaw sign and keeps the same magnitude.
"""

from __future__ import annotations

POSES = ("front", "left", "right")

# Slight turn, not a profile. Values are degrees.
FRONT_YAW_MAX = 12.0
TURN_YAW_MIN = 15.0
PITCH_MAX = 30.0
ROLL_MAX = 35.0


def pose_accepts(pose: str, yaw: float, pitch: float, roll: float) -> bool:
    if abs(pitch) > PITCH_MAX or abs(roll) > ROLL_MAX:
        return False
    if pose == "front":
        return abs(yaw) <= FRONT_YAW_MAX
    if pose == "left":
        return yaw >= TURN_YAW_MIN
    if pose == "right":
        return yaw <= -TURN_YAW_MIN
    return False


def pose_failure_code(pose: str) -> str:
    return {"front": "not_front", "left": "not_left", "right": "not_right"}[pose]
