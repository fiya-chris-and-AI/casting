import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const BASE_URL = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const API_KEY = process.env.YOUCAM_API_KEY_BACKUP;
if (!API_KEY) throw new Error("YOUCAM_API_KEY_BACKUP not set");

async function youcamFetch(pathname, init = {}) {
  const url = pathname.startsWith("http") ? pathname : `${BASE_URL}${pathname}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${pathname} -> ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function uploadFile(bytes, fileName, contentType) {
  const createRes = await youcamFetch("/s2s/v2.0/file", {
    method: "POST",
    body: JSON.stringify({ files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }] }),
  });
  const fileEntry = createRes?.data?.files?.[0] ?? createRes?.files?.[0];
  const uploadRequest = fileEntry.requests?.[0];
  const putRes = await fetch(uploadRequest.url, {
    method: uploadRequest.method ?? "PUT",
    headers: uploadRequest.headers ?? { "Content-Type": contentType },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`Upload PUT failed: ${putRes.status} ${await putRes.text()}`);
  return fileEntry.file_id;
}

async function runTask(taskPath, payload, { intervalMs = 2000, maxAttempts = 60 } = {}) {
  const startRes = await youcamFetch(taskPath, { method: "POST", body: JSON.stringify(payload) });
  const taskId = startRes?.data?.task_id ?? startRes?.task_id;
  if (!taskId) throw new Error(`No task_id from ${taskPath}: ${JSON.stringify(startRes)}`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const pollRes = await youcamFetch(`${taskPath}/${taskId}`, { method: "GET" });
    const data = pollRes?.data ?? pollRes;
    if (data?.task_status === "success") return data.results;
    if (data?.task_status === "error") throw new Error(`Task ${taskPath} failed: ${JSON.stringify(data)}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Task ${taskPath} timed out polling`);
}

const SD_SKIN_CONCERNS = [
  "wrinkle", "pore", "texture", "acne", "oiliness", "radiance", "eye_bag",
  "age_spot", "dark_circle_v2", "droopy_upper_eyelid", "droopy_lower_eyelid",
  "firmness", "moisture", "redness", "tear_trough", "skin_type",
];

const id = process.argv[2] ?? "panel-fitzpatrick-VI";
const intendedBand = process.argv[3] ?? "VI";
const ageRange = process.argv[4] ?? "50s";
const gender = process.argv[5] ?? "man";
const imagePath = path.join(__dirname, "..", "panel", "source-images", `${id}.png`);
const bytes = fs.readFileSync(imagePath);

console.log(`[${id}] uploading via backup account...`);
const fileId = await uploadFile(bytes, `${id}.png`, "image/png");

console.log(`[${id}] fitzpatrick-scale-analyzer...`);
const fitzResults = await runTask("/s2s/v2.0/task/fitzpatrick-scale-analyzer", { src_file_id: fileId, version: "1.0" });

console.log(`[${id}] skin-tone-analysis...`);
const toneResults = await runTask("/s2s/v2.0/task/skin-tone-analysis", { src_file_id: fileId });

console.log(`[${id}] skin-analysis...`);
const skinResults = await runTask("/s2s/v2.1/task/skin-analysis", {
  src_file_id: fileId,
  dst_actions: SD_SKIN_CONCERNS,
  miniserver_args: { enable_mask_overlay: false },
  format: "json",
  pf_camera_kit: false,
});

const skinTypeOutput = skinResults?.output?.find((o) => o.type === "skin_type") ?? null;

const result = {
  id,
  intendedBand,
  ageRange,
  gender,
  imageProvenance: "AI-generated (Gemini 3.1 Flash Image), fictional person, no real individual depicted",
  measuredAt: new Date().toISOString(),
  fitzpatrickScale: fitzResults?.fitzpatrick_scale ?? null,
  skinColorHex: toneResults?.color?.skin_color ?? null,
  eyeColorHex: toneResults?.color?.eye_color ?? null,
  lipColorHex: toneResults?.color?.lip_color ?? null,
  hairColorHex: toneResults?.color?.hair_color ?? null,
  faceQuality: toneResults?.face_quality ?? null,
  skinTypeScore: skinTypeOutput ? { rawScore: skinTypeOutput.raw_score, uiScore: skinTypeOutput.ui_score } : null,
  measuredViaAccount: "backup",
};

const dataPath = path.join(__dirname, "..", "panel", "panel-data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
data.panel = data.panel.map((p) => (p.id === id ? result : p));
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`[${id}] done — fitzpatrick=${result.fitzpatrickScale} skin_color=${result.skinColorHex}`);
console.log(`Updated ${dataPath}`);
