"""One active face profile per student. Re-enrollment replaces it."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

EMBEDDING_DIM = 512


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class FaceStore:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
              student_id TEXT PRIMARY KEY,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS samples (
              student_id TEXT NOT NULL,
              pose TEXT NOT NULL,
              embedding BLOB NOT NULL,
              det_score REAL NOT NULL,
              yaw REAL NOT NULL,
              quality_json TEXT NOT NULL,
              PRIMARY KEY (student_id, pose)
            );
            """
        )
        self._conn.commit()

    def replace(self, student_id: str, samples: list[dict]) -> str:
        updated = _now()
        with self._conn:
            self._conn.execute("DELETE FROM samples WHERE student_id = ?", (student_id,))
            self._conn.execute(
                "INSERT INTO profiles (student_id, updated_at) VALUES (?, ?) "
                "ON CONFLICT(student_id) DO UPDATE SET updated_at = excluded.updated_at",
                (student_id, updated),
            )
            self._conn.executemany(
                "INSERT INTO samples (student_id, pose, embedding, det_score, yaw, quality_json) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (
                        student_id,
                        sample["pose"],
                        sample["embedding"].astype(np.float32).tobytes(),
                        sample["detScore"],
                        sample["yaw"],
                        json.dumps(sample["quality"]),
                    )
                    for sample in samples
                ],
            )
        return updated

    def delete(self, student_id: str) -> bool:
        with self._conn:
            cur = self._conn.execute("DELETE FROM profiles WHERE student_id = ?", (student_id,))
            self._conn.execute("DELETE FROM samples WHERE student_id = ?", (student_id,))
        return cur.rowcount > 0

    def get(self, student_id: str, *, include_embeddings: bool) -> dict | None:
        profile = self._conn.execute(
            "SELECT updated_at FROM profiles WHERE student_id = ?", (student_id,)
        ).fetchone()
        if profile is None:
            return None
        rows = self._conn.execute(
            "SELECT pose, embedding, det_score, yaw, quality_json FROM samples WHERE student_id = ? ORDER BY pose",
            (student_id,),
        ).fetchall()
        captures = []
        for row in rows:
            vector = np.frombuffer(row["embedding"], dtype=np.float32)
            item = {
                "pose": row["pose"],
                "detScore": row["det_score"],
                "yaw": row["yaw"],
                "embeddingDimensions": int(vector.shape[0]),
                "embeddingNorm": round(float(np.linalg.norm(vector)), 4),
                "embeddingPreview": [round(float(v), 4) for v in vector[:8]],
                "quality": json.loads(row["quality_json"]),
            }
            if include_embeddings:
                item["embedding"] = [round(float(v), 6) for v in vector]
            captures.append(item)
        return {
            "studentId": student_id,
            "updatedAt": profile["updated_at"],
            "poses": [item["pose"] for item in captures],
            "captures": captures,
        }

    def embeddings(self, candidate_ids: list[str] | None) -> list[tuple[str, str, np.ndarray]]:
        if candidate_ids is not None and len(candidate_ids) == 0:
            return []
        if candidate_ids is None:
            rows = self._conn.execute("SELECT student_id, pose, embedding FROM samples").fetchall()
        else:
            marks = ",".join("?" for _ in candidate_ids)
            rows = self._conn.execute(
                f"SELECT student_id, pose, embedding FROM samples WHERE student_id IN ({marks})",
                candidate_ids,
            ).fetchall()
        return [
            (row["student_id"], row["pose"], np.frombuffer(row["embedding"], dtype=np.float32))
            for row in rows
        ]
