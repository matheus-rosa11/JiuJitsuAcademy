"use client";

import { useEffect, useState } from "react";
import { FaceEnrollment, type EnrollmentShot } from "@/components/FaceEnrollment";
import { Badge, Button, Card, PageHeader, Spinner } from "@/components/ui";
import { POSES, type Pose } from "@/lib/faceGuide";
import {
  deleteFace,
  demoSamples,
  FaceApiError,
  recognizeFaces,
  type FaceProfile,
  type RecognizedFace,
} from "@/lib/faces";

const DEMO_STUDENT = "demo-facial";

const POSE_LABEL: Record<Pose, string> = {
  front: "Frente",
  left: "Esquerda",
  right: "Direita",
};

export default function FacialDemoPage() {
  const [source, setSource] = useState<"camera" | "samples">("samples");
  const [samples, setSamples] = useState<{ front: string; left: string; right: string; group: string } | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [shots, setShots] = useState<EnrollmentShot[]>([]);
  const [profile, setProfile] = useState<FaceProfile | null>(null);
  const [live, setLive] = useState<{ step: Pose; code: string; yaw: number | null; holding: boolean } | null>(null);
  const [faces, setFaces] = useState<RecognizedFace[] | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(true);

  useEffect(() => {
    let cancelled = false;
    demoSamples()
      .then((next) => {
        if (!cancelled) setSamples(next);
      })
      .catch((error: Error) => {
        if (!cancelled) setSampleError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingSamples(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadSamples() {
    setLoadingSamples(true);
    setSampleError(null);
    try {
      setSamples(await demoSamples());
      setSource("samples");
    } catch (error) {
      setSampleError(error instanceof Error ? error.message : "Fotos de exemplo indisponíveis.");
    } finally {
      setLoadingSamples(false);
    }
  }

  async function recognizeGroup() {
    if (!samples) return;
    setRecognizing(true);
    try {
      const result = await recognizeFaces(samples.group, [DEMO_STUDENT]);
      setFaces(result.faces);
    } catch (error) {
      setSampleError(error instanceof Error ? error.message : "Não foi possível reconhecer a foto.");
    } finally {
      setRecognizing(false);
    }
  }

  async function removeProfile() {
    try {
      await deleteFace(DEMO_STUDENT);
    } catch (error) {
      if (!(error instanceof FaceApiError) || error.status !== 404) {
        setSampleError(error instanceof Error ? error.message : "Não foi possível remover.");
        return;
      }
    }
    setProfile(null);
    setShots([]);
    setFaces(null);
    setAttempt((value) => value + 1);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Demonstração do cadastro facial"
        description="Tela técnica para desenvolvimento. O aluno vê apenas o fluxo guiado, sem estes detalhes."
      />
      <div className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        As fotos de exemplo vêm da biblioteca InsightFace e não são alunos da academia. A foto frontal e a foto de lado são pessoas diferentes; a esquerda é o espelho da foto de lado. Servem para exercitar o fluxo sem webcam.
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <div>
          <div className="mb-4 flex gap-2">
            <Button variant={source === "camera" ? "primary" : "secondary"} size="sm" onClick={() => setSource("camera")}>
              Usar câmera
            </Button>
            <Button
              variant={source === "samples" ? "primary" : "secondary"}
              size="sm"
              loading={loadingSamples}
              onClick={() => void (samples ? setSource("samples") : loadSamples())}
            >
              Usar fotos de exemplo
            </Button>
          </div>
          {source === "samples" && !samples ? (
            <Card className="p-6 text-sm text-zinc-600">
              {sampleError ? <p className="text-red-600">{sampleError}</p> : <p>Carregue as fotos de exemplo para simular a câmera.</p>}
              <Button className="mt-4" onClick={() => void loadSamples()} loading={loadingSamples}>
                Carregar fotos de exemplo
              </Button>
            </Card>
          ) : (
            <FaceEnrollment
              key={`${source}-${attempt}`}
              studentId={DEMO_STUDENT}
              source={source}
              samples={samples ?? undefined}
              continueLabel="Concluir demonstração"
              onShot={(shot) => setShots((current) => [...current.filter((item) => item.pose !== shot.pose), shot])}
              onEnrolled={(next) => setProfile(next)}
              onLive={setLive}
              onContinue={() => undefined}
            />
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold text-zinc-900">Enrollment</p>
            <p className="mt-1 text-sm text-zinc-500">Student: {DEMO_STUDENT}</p>
            {live && (
              <p className="mt-2 text-xs text-zinc-500">
                Ao vivo · {POSE_LABEL[live.step]} · {live.holding ? "posição aceita" : "ajustando"}
                {live.yaw != null ? ` · orientação ${live.yaw.toFixed(0)}°` : ""}
              </p>
            )}
            <ul className="mt-4 space-y-4">
              {POSES.map((pose) => {
                const shot = shots.find((item) => item.pose === pose);
                return (
                  <li key={pose}>
                    <p className="text-sm font-medium text-zinc-900">{POSE_LABEL[pose]}</p>
                    <p className="text-sm text-zinc-600">{shot ? "✓ Rosto detectado" : "· Aguardando"}</p>
                    <p className="text-sm text-zinc-600">{shot ? "✓ Qualidade aceitável" : "· Aguardando"}</p>
                    <p className="text-sm text-zinc-600">
                      {profile?.captures.some((item) => item.pose === pose) ? "✓ Embedding gerado" : "· Aguardando"}
                    </p>
                    {shot && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shot.imageBase64} alt="" className="mt-2 h-24 w-20 rounded-xl object-cover" />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {profile && (
            <Card className="p-5">
              <p className="text-sm font-semibold text-zinc-900">Face profile</p>
              <p className="mt-1 text-xs text-zinc-500">Atualizado em {profile.updatedAt}</p>
              <ul className="mt-3 space-y-3">
                {profile.captures.map((capture) => (
                  <li key={capture.pose} className="text-sm text-zinc-700">
                    <span className="font-medium">{POSE_LABEL[capture.pose]}</span>
                    {" · "}
                    {capture.embeddingDimensions} dimensões · norma {capture.embeddingNorm?.toFixed(3) ?? "—"} · yaw {capture.yaw.toFixed(1)}°
                    {capture.embeddingPreview && (
                      <span className="mt-1 block font-mono text-xs text-zinc-500">{capture.embeddingPreview.map((value) => value.toFixed(3)).join("  ")}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void recognizeGroup()} loading={recognizing} disabled={!samples}>
                  Reconhecer foto de grupo
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setShots([]);
                    setFaces(null);
                    setAttempt((value) => value + 1);
                  }}
                >
                  Repetir enrollment
                </Button>
                <Button size="sm" variant="danger" onClick={() => void removeProfile()}>
                  Remover cadastro
                </Button>
              </div>
              {!samples && <p className="mt-2 text-xs text-zinc-500">Carregue as fotos de exemplo para testar a foto de grupo.</p>}
            </Card>
          )}

          {faces && (
            <Card className="p-5">
              <p className="text-sm font-semibold text-zinc-900">Foto da turma</p>
              <ul className="mt-3 space-y-2">
                {faces.map((face, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-700">
                      Rosto {index + 1}
                      {face.studentId ? ` · ${face.studentId}` : ""}
                      {face.score != null ? ` · ${face.score.toFixed(2)}` : ""}
                      {face.ambiguous ? " · ambíguo" : ""}
                    </span>
                    <Badge tone={face.decision === "MATCHED" ? "green" : face.decision === "REVIEW" ? "amber" : "zinc"}>{face.decision}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {loadingSamples && !samples && <Spinner label="Carregando fotos de exemplo..." />}
        </div>
      </div>
    </div>
  );
}
