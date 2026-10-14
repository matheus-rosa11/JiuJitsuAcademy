"""Run the class-photo benchmark. Prints an honest report and never invents a score.

Dataset layout (see docs/CLASS_PHOTO_EVAL.md):

    dataset/
      manifest.json
      enrollment/<studentId>/front.jpg
      enrollment/<studentId>/left.jpg
      enrollment/<studentId>/right.jpg
      images/<file named by the manifest>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

from benchmark.metrics import summarize

POSES = ("front", "left", "right")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _pose_files(student_dir: Path) -> dict[str, Path]:
    found = {}
    for pose in POSES:
        for suffix in (".jpg", ".jpeg", ".png", ".webp"):
            path = student_dir / f"{pose}{suffix}"
            if path.is_file():
                found[pose] = path
                break
    return found


def _incomplete(reason: str, **extra) -> dict:
    return {
        "status": "incomplete",
        "reason": reason,
        "metrics": None,
        "comparison": None,
        "images": [],
        **extra,
    }


def _load_manifest(dataset: Path) -> dict:
    manifest_path = dataset / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(manifest_path)
    return json.loads(manifest_path.read_text())


def evaluate(dataset: Path) -> dict:
    if not dataset.is_dir():
        return _incomplete(f"Não há dataset em {dataset}.")
    try:
        manifest = _load_manifest(dataset)
    except FileNotFoundError:
        return _incomplete(f"Falta {dataset / 'manifest.json'}.")
    except json.JSONDecodeError as exc:
        return _incomplete(f"manifest.json inválido: {exc}")

    images = manifest.get("images") or []
    if not images:
        return _incomplete("O manifest não lista fotografias.")

    enrollment_root = dataset / "enrollment"
    students: dict[str, dict[str, Path]] = {}
    if enrollment_root.is_dir():
        for student_dir in enrollment_root.iterdir():
            if student_dir.is_dir():
                poses = _pose_files(student_dir)
                if poses:
                    students[student_dir.name] = poses
    if not students:
        return _incomplete("Nenhum enrollment foi encontrado. Separe as fotos de cadastro das fotos de prova.")

    cohort = sorted(student_id for student_id, poses in students.items() if set(POSES) <= set(poses))
    enrollment_hashes = {_sha256(path) for poses in students.values() for path in poses.values()}

    prepared = []
    leaked = []
    for image in images:
        probe = dataset / image["file"]
        if not probe.is_file():
            prepared.append({"id": image.get("id"), "excluded": True, "reason": "arquivo ausente"})
            continue
        if _sha256(probe) in enrollment_hashes:
            leaked.append(image.get("id"))
            prepared.append({"id": image.get("id"), "excluded": True, "reason": "a mesma foto está no enrollment e na prova"})
            continue
        prepared.append({"id": image.get("id"), "excluded": False, "spec": image, "probe": probe})

    usable = [item for item in prepared if not item["excluded"]]
    if not usable:
        return _incomplete(
            "Nenhuma foto de prova pôde entrar. A mesma imagem não pode servir de cadastro e de avaliação.",
            leaked=leaked,
        )
    if not cohort:
        return _incomplete(
            "Nenhum aluno tem as três poses em arquivos próprios. A comparação de uma foto contra três ângulos não foi executada.",
            leaked=leaked,
        )

    from benchmark.execute import score_dataset

    front = score_dataset(students, cohort, usable, poses=("front",))
    three = score_dataset(students, cohort, usable, poses=POSES)
    return {
        "status": "incomplete" if front["summary"]["status"] == "incomplete" or three["summary"]["status"] == "incomplete" else "observed",
        "reason": None
        if front["summary"]["status"] == "observed" and three["summary"]["status"] == "observed"
        else "O conjunto ainda não responde a pergunta da chamada em foto real de treino.",
        "leaked": leaked,
        "cohort": cohort,
        "excludedFromComparison": sorted(set(students) - set(cohort)),
        "comparison": {
            "frontOnly": front["summary"],
            "threeAngles": three["summary"],
            "note": "Os dois lados usam os mesmos alunos e as mesmas fotos de prova. A diferença é observada, sem teste de significância.",
        },
        "images": {"frontOnly": front["images"], "threeAngles": three["images"]},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Avalia o reconhecimento em fotos coletivas.")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args()
    started = time.perf_counter()
    report = evaluate(args.dataset)
    report["benchmarkElapsedMs"] = int((time.perf_counter() - started) * 1000)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    print(text)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
