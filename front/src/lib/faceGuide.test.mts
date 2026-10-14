import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLD_MS,
  advanceHold,
  assessReading,
  holdComplete,
  instructionFor,
  nextPose,
  turnHintSide,
  yawFromLandmarks,
  yawFromMatrix,
  type FrameReading,
} from "./faceGuide.ts";

function reading(partial: Partial<FrameReading> = {}): FrameReading {
  return {
    faceCount: 1,
    centerX: 0.5,
    centerY: 0.46,
    faceWidth: 0.34,
    faceHeight: 0.42,
    brightness: 140,
    yaw: 0,
    eyesClosed: false,
    ...partial,
  };
}

test("a frontal face is ready and a turned face is not", () => {
  assert.equal(assessReading("front", reading()).code, "ready");
  assert.equal(assessReading("front", reading({ yaw: 22 })).code, "not_front");
  assert.equal(assessReading("left", reading({ yaw: 0 })).code, "not_left");
  assert.equal(assessReading("left", reading({ yaw: 16 })).ok, true);
  assert.equal(assessReading("right", reading({ yaw: -16 })).ok, true);
  assert.equal(assessReading("right", reading({ yaw: 16 })).code, "not_right");
});

test("guidance stays in everyday language", () => {
  assert.equal(instructionFor("front", "no_face", "seek"), "Posicione seu rosto dentro do círculo");
  assert.equal(instructionFor("left", "no_face", "seek"), "Não conseguimos identificar seu rosto");
  assert.equal(instructionFor("front", "too_small", "seek"), "Aproxime um pouco o rosto");
  assert.equal(instructionFor("front", "off_center", "seek"), "Posicione seu rosto no centro");
  assert.equal(instructionFor("front", "dark", "seek"), "Encontre um local mais iluminado");
  assert.equal(instructionFor("left", "not_left", "seek"), "Agora vire lentamente o rosto para a esquerda");
  assert.equal(instructionFor("front", "ready", "hold"), "Capturando...");
  assert.equal(instructionFor("left", "ready", "perfect"), "Perfeito!");
  assert.equal(instructionFor("right", "ready", "done"), "Cadastro facial concluído!");
  assert.equal(instructionFor("front", "ready", "seek").includes("embedding"), false);
});

test("the hold resets when the face leaves and completes only after the wait", () => {
  assert.equal(advanceHold(400, false, 100), 0);
  assert.equal(advanceHold(700, true, 500), HOLD_MS);
  assert.equal(holdComplete(HOLD_MS - 1), false);
  assert.equal(holdComplete(HOLD_MS), true);
  assert.equal(nextPose("front"), "left");
  assert.equal(nextPose("left"), "right");
  assert.equal(nextPose("right"), null);
});

test("yaw follows the subject's left, not the edge of the picture", () => {
  const theta = (20 * Math.PI) / 180;
  const matrix = new Array(16).fill(0);
  matrix[0] = Math.cos(theta);
  matrix[2] = -Math.sin(theta);
  matrix[5] = 1;
  matrix[8] = Math.sin(theta);
  matrix[10] = Math.cos(theta);
  matrix[15] = 1;
  assert.ok(Math.abs((yawFromMatrix(matrix) ?? 0) - 20) < 0.01);

  const landmarks = Array.from({ length: 300 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[1] = { x: 0.55, y: 0.5 };
  landmarks[33] = { x: 0.4, y: 0.4 };
  landmarks[263] = { x: 0.6, y: 0.4 };
  assert.ok(Math.abs((yawFromLandmarks(landmarks) ?? 0) - 30) < 0.001);
});

test("the turn hint points to the subject's left in a mirror", () => {
  assert.equal(turnHintSide("left", true), "left");
  assert.equal(turnHintSide("left", false), "right");
  assert.equal(turnHintSide("front", true), null);
});

test("bad light, size, and a second person interrupt the capture", () => {
  assert.equal(assessReading("front", reading({ faceCount: 0 })).code, "no_face");
  assert.equal(assessReading("front", reading({ faceCount: 2 })).code, "multiple");
  assert.equal(assessReading("front", reading({ brightness: 10 })).code, "dark");
  assert.equal(assessReading("front", reading({ faceWidth: 0.05, faceHeight: 0.05 })).code, "too_small");
  assert.equal(assessReading("front", reading({ centerX: 0.1 })).code, "off_center");
  assert.equal(assessReading("front", reading({ eyesClosed: true })).code, "not_front");
});
