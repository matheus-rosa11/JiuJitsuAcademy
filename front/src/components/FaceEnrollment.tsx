"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  HOLD_MS,
  POSES,
  advanceHold,
  assessReading,
  brightnessOf,
  holdComplete,
  instructionFor,
  nextPose,
  turnHintSide,
  type GuidePhase,
  type Pose,
} from "@/lib/faceGuide";
import { checkFace, enrollFace, getFaceProfile, type FaceProfile, type FaceQuality } from "@/lib/faces";
import { loadFaceGuide, readingFromResult } from "@/lib/faceVision";
import { cn } from "./ui";

export interface EnrollmentShot {
  pose: Pose;
  imageBase64: string;
  quality: FaceQuality;
}

interface Props {
  studentId: string;
  source: "camera" | "samples";
  samples?: { front: string; left: string; right: string };
  autoContinue?: boolean;
  continueLabel?: string;
  onContinue: () => void;
  onSkip?: () => void;
  onShot?: (shot: EnrollmentShot) => void;
  onEnrolled?: (profile: FaceProfile) => void;
  onLive?: (live: { step: Pose; code: string; yaw: number | null; holding: boolean }) => void;
}

type Screen = "idle" | "running" | "error";

function FaceGlyph({ tilt }: { tilt: number }) {
  return (
    <svg viewBox="0 0 120 150" className="h-28 w-24 text-white" style={{ transform: `rotate(${tilt}deg)` }} aria-hidden>
      <ellipse cx="60" cy="78" rx="34" ry="44" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="46" cy="70" r="3.5" fill="currentColor" />
      <circle cx="74" cy="70" r="3.5" fill="currentColor" />
      <path d="M60 78 v16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 108 q10 8 20 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FaceEnrollment({
  studentId,
  source,
  samples,
  autoContinue = false,
  continueLabel = "Continuar",
  onContinue,
  onSkip,
  onShot,
  onEnrolled,
  onLive,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stepRef = useRef<Pose>("front");
  const phaseRef = useRef<GuidePhase>("seek");
  const heldRef = useRef(0);
  const lastTs = useRef(0);
  const busy = useRef(false);
  const shots = useRef<{ pose: Pose; imageBase64: string }[]>([]);
  const onShotRef = useRef(onShot);
  const onEnrolledRef = useRef(onEnrolled);
  const onLiveRef = useRef(onLive);
  const onContinueRef = useRef(onContinue);

  const [screen, setScreen] = useState<Screen>(source === "samples" ? "running" : "idle");
  const [phase, setPhase] = useState<GuidePhase>("seek");
  const [step, setStep] = useState<Pose>("front");
  const [code, setCode] = useState("no_face");
  const [held, setHeld] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [started, setStarted] = useState(source === "samples");

  useEffect(() => {
    onShotRef.current = onShot;
    onEnrolledRef.current = onEnrolled;
    onLiveRef.current = onLive;
    onContinueRef.current = onContinue;
  });

  function setGuide(nextPhase: GuidePhase, nextStep = stepRef.current) {
    phaseRef.current = nextPhase;
    stepRef.current = nextStep;
    setPhase(nextPhase);
    setStep(nextStep);
  }

  useEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let raf = 0;
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 96;
    sampleCanvas.height = 128;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

    async function fail(message: string) {
      if (cancelled) return;
      setError(message);
      setScreen("error");
    }

    function captureFrame(): string | null {
      if (!video || !video.videoWidth) return null;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.92);
    }

    async function acceptFrame(imageBase64: string) {
      const current = stepRef.current;
      try {
        const checked = await checkFace(current, imageBase64);
        if (cancelled || stepRef.current !== current) return;
        shots.current = [...shots.current.filter((item) => item.pose !== current), { pose: current, imageBase64 }];
        onShotRef.current?.({ pose: current, imageBase64, quality: checked.quality });
        const following = nextPose(current);
        heldRef.current = 0;
        setHeld(0);
        if (!following) {
          setGuide("processing");
          const enrolled = await enrollFace(studentId, shots.current);
          if (cancelled) return;
          const profile = await getFaceProfile(studentId, true).catch(() => ({
            studentId,
            updatedAt: enrolled.updatedAt,
            poses: enrolled.captures.map((item) => item.pose),
            captures: enrolled.captures,
          }));
          onEnrolledRef.current?.(profile);
          setGuide("done");
          if (autoContinue) window.setTimeout(() => onContinueRef.current(), 1800);
          return;
        }
        setGuide("perfect", current);
        window.setTimeout(() => {
          if (cancelled) return;
          lastTs.current = 0;
          heldRef.current = 0;
          setHeld(0);
          setCode(following === "left" ? "not_left" : "not_right");
          setGuide("seek", following);
          busy.current = false;
        }, 700);
      } catch (err) {
        if (cancelled) return;
        heldRef.current = 0;
        setHeld(0);
        setCode("no_face");
        setGuide("seek", current);
        showServerMessage(err instanceof Error ? err.message : "Não conseguimos identificar seu rosto");
        busy.current = false;
      }
    }

    let customUntil = 0;
    let customActive = false;
    function showServerMessage(message: string) {
      customActive = true;
      customUntil = performance.now() + 2200;
      setCustomMessage(message);
    }

    let detecting = false;
    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const currentPhase = phaseRef.current;
      if (customActive && now > customUntil) {
        customActive = false;
        setCustomMessage(null);
      }
      if (currentPhase !== "seek" && currentPhase !== "hold") return;
      if (!video || video.readyState < 2 || busy.current || detecting) return;
      detecting = true;
      void guidePromise.then((landmarker) => {
        detecting = false;
        if (!landmarker || cancelled || busy.current) return;
        if (phaseRef.current !== "seek" && phaseRef.current !== "hold") return;
        let result;
        try {
          result = landmarker.detectForVideo(video, now);
        } catch {
          return;
        }
        let brightness: number | null = null;
        const landmarks = result.faceLandmarks?.[0];
        if (landmarks && sampleCtx && video.videoWidth) {
          sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
          const pixels = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
          const box = {
            centerX: landmarks.reduce((sum, point) => sum + point.x, 0) / landmarks.length,
            centerY: landmarks.reduce((sum, point) => sum + point.y, 0) / landmarks.length,
            faceWidth: 0.4,
            faceHeight: 0.4,
          };
          brightness = brightnessOf(pixels.data, sampleCanvas.width, sampleCanvas.height, box);
        }
        const reading = readingFromResult(result, brightness);
        const verdict = assessReading(stepRef.current, reading);
        const delta = lastTs.current ? now - lastTs.current : 0;
        lastTs.current = now;
        const nextHeld = advanceHold(heldRef.current, verdict.ok, delta);
        heldRef.current = nextHeld;
        setHeld(nextHeld);
        if (!customActive) setCode(verdict.code);
        setGuide(verdict.ok ? "hold" : "seek");
        onLiveRef.current?.({
          step: stepRef.current,
          code: verdict.code,
          yaw: reading.yaw,
          holding: verdict.ok,
        });
        if (holdComplete(nextHeld)) {
          const image = captureFrame();
          if (!image) return;
          busy.current = true;
          void acceptFrame(image);
        }
      });
    }

    const guidePromise = loadFaceGuide()
      .then((landmarker) => landmarker)
      .catch(() => {
        void fail("Não conseguimos preparar a câmera neste navegador.");
        return null;
      });

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [started, studentId, autoContinue]);

  useEffect(() => {
    if (!started || source !== "samples" || !samples) return;
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const images = {
      front: new Image(),
      left: new Image(),
      right: new Image(),
    };
    images.front.src = samples.front;
    images.left.src = samples.left;
    images.right.src = samples.right;
    const stream = canvas.captureStream(12);
    streamRef.current = stream;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    let raf = 0;
    const paint = () => {
      const image = images[stepRef.current];
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (image.complete && image.naturalWidth) {
        const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      }
      raf = requestAnimationFrame(paint);
    };
    paint();
    return () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [started, source, samples]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    setError(null);
    setScreen("running");
    setStarted(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
    } catch {
      setStarted(false);
      setError("Não conseguimos acessar a câmera. Libere a permissão do navegador ou faça isso depois.");
      setScreen("error");
    }
  }

  const mirror = source === "camera";
  const hint = turnHintSide(step, mirror);
  const showVideo = screen === "running" && phase !== "done";
  const aligned = phase === "hold" || phase === "perfect" || phase === "done";
  const instruction = customMessage ?? instructionFor(step, code, phase === "hold" && held > 0 ? "hold" : phase);
  const progress = phase === "hold" ? held / HOLD_MS : phase === "perfect" || phase === "processing" || phase === "done" ? 1 : 0;
  const tilt = step === "left" ? (mirror ? -12 : 12) : step === "right" ? (mirror ? 12 : -12) : 0;
  const stepIndex = POSES.indexOf(step);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="face-stage overflow-hidden rounded-[2rem] shadow-xl">
        <div className="relative h-[28rem] bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={cn("h-full w-full object-cover", !showVideo && "invisible", mirror && "[transform:scaleX(-1)]")}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "relative flex h-80 w-60 items-center justify-center rounded-[50%] border transition-all duration-700 ease-out",
                aligned
                  ? "border-emerald-200 shadow-[0_0_0_999px_rgba(0,0,0,0.5),0_0_56px_rgba(167,243,208,0.45)]"
                  : "animate-face-breathe border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.5)]",
              )}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[50%]">
                {screen === "running" && (phase === "seek" || phase === "hold") ? (
                  <div className="animate-face-scan absolute left-[14%] right-[14%] h-10 bg-gradient-to-b from-transparent via-white/70 to-transparent" />
                ) : null}
              </div>
              {(phase === "seek" && code === "no_face") || screen !== "running" ? <FaceGlyph tilt={tilt} /> : null}
              {phase === "perfect" || phase === "done" ? (
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-8" />
                </div>
              ) : null}
              {hint === "left" && phase === "seek" ? <ChevronLeft className="absolute -left-8 size-7 text-white/80" /> : null}
              {hint === "right" && phase === "seek" ? <ChevronRight className="absolute -right-8 size-7 text-white/80" /> : null}
            </div>
          </div>
        </div>
        <div className="px-6 pb-8 pt-5 text-center">
          <p className="min-h-7 text-[17px] font-medium tracking-tight text-[#f4f4f5]" aria-live="polite">
            {screen === "error" ? error : instruction}
          </p>
          <div className="mx-auto mt-4 h-1 w-36 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
          <div className="mt-5 flex justify-center gap-2">
            {POSES.map((pose, index) => (
              <span
                key={pose}
                className={cn(
                  "size-1.5 rounded-full",
                  phase === "done" || index < stepIndex || (index === stepIndex && (phase === "perfect" || phase === "processing"))
                    ? "bg-white"
                    : index === stepIndex && screen === "running"
                      ? "bg-white/70"
                      : "bg-white/25",
                )}
              />
            ))}
          </div>
          {screen === "idle" && (
            <button type="button" className="face-start mt-7 h-12 w-full cursor-pointer rounded-full text-[15px] font-semibold" onClick={() => void startCamera()}>
              Começar
            </button>
          )}
          {screen === "error" && (
            <button type="button" className="face-start mt-7 h-12 w-full cursor-pointer rounded-full text-[15px] font-semibold" onClick={() => void startCamera()}>
              Tentar de novo
            </button>
          )}
          {phase === "done" && (
            <button type="button" className="face-start mt-7 h-12 w-full cursor-pointer rounded-full text-[15px] font-semibold" onClick={onContinue}>
              {continueLabel}
            </button>
          )}
        </div>
      </div>
      {onSkip && phase !== "done" && (
        <button type="button" className="mt-4 w-full cursor-pointer text-sm text-zinc-500 hover:text-zinc-800" onClick={onSkip}>
          Fazer isso depois
        </button>
      )}
    </div>
  );
}
