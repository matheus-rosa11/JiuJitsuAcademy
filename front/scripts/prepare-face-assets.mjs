import { cpSync, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { get } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDest = path.join(root, "public/mediapipe");
const modelDest = path.join(root, "public/models/face_landmarker.task");
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

if (!existsSync(wasmSrc)) {
  console.error("Pacote @mediapipe/tasks-vision não encontrado. Rode npm install em front/.");
  process.exit(1);
}

mkdirSync(wasmDest, { recursive: true });
cpSync(wasmSrc, wasmDest, { recursive: true });

if (existsSync(modelDest)) {
  process.exit(0);
}

mkdirSync(path.dirname(modelDest), { recursive: true });
await new Promise((resolve, reject) => {
  const file = createWriteStream(modelDest);
  get(modelUrl, (response) => {
    if (response.statusCode !== 200) {
      reject(new Error(`Falha ao baixar o modelo de orientação (${response.statusCode}).`));
      return;
    }
    response.pipe(file);
    file.on("finish", () => file.close(resolve));
  }).on("error", reject);
});
