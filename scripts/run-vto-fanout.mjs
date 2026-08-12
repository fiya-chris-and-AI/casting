import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const BASE_URL = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const API_KEY = process.env.YOUCAM_ACCOUNT === "primary" ? process.env.YOUCAM_API_KEY : process.env.YOUCAM_API_KEY_BACKUP;

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

async function runTask(taskPath, payload, { intervalMs = 2000, maxAttempts = 90 } = {}) {
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

const PANEL_IDS = [
  "panel-fitzpatrick-I",
  "panel-fitzpatrick-II",
  "panel-fitzpatrick-III",
  "panel-fitzpatrick-III-b",
  "panel-fitzpatrick-IV",
  "panel-fitzpatrick-V",
  "panel-fitzpatrick-V-b",
  "panel-fitzpatrick-VI",
];

const BODY_DIR = path.join(__dirname, "..", "panel", "body-images");
const RESULT_DIR = path.join(__dirname, "..", "panel", "vto-results");
const PRODUCT_PATH = path.join(__dirname, "..", "panel", "product-images", "demo-product-tshirt.png");
fs.mkdirSync(RESULT_DIR, { recursive: true });

async function runOne(id, garmentFileId) {
  const t0 = Date.now();
  try {
    const bodyBytes = fs.readFileSync(path.join(BODY_DIR, `${id}.png`));
    const person = await uploadFile(bodyBytes, `${id}.png`, "image/png");
    const results = await runTask("/s2s/v2.0/task/cloth-v4", {
      src_file_id: person,
      ref_file_id: garmentFileId,
      garment_category: "upper_body",
    });
    const remoteUrl = results?.url;
    if (!remoteUrl) throw new Error(`No result url: ${JSON.stringify(results)}`);

    const imgRes = await fetch(remoteUrl);
    if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const localPath = path.join(RESULT_DIR, `${id}.jpg`);
    fs.writeFileSync(localPath, buf);

    const wallClockMs = Date.now() - t0;
    console.log(`[${id}] OK in ${wallClockMs}ms -> ${localPath}`);
    return { id, status: "success", wallClockMs, localPath: `panel/vto-results/${id}.jpg` };
  } catch (err) {
    const wallClockMs = Date.now() - t0;
    console.error(`[${id}] FAILED after ${wallClockMs}ms:`, err.message);
    return { id, status: "error", wallClockMs, error: err.message };
  }
}

async function main() {
  console.log("uploading garment...");
  const productBytes = fs.readFileSync(PRODUCT_PATH);
  const garmentFileId = await uploadFile(productBytes, "demo-product-tshirt.png", "image/png");
  console.log("garment file_id:", garmentFileId);

  const fanoutStart = Date.now();
  const results = await Promise.all(PANEL_IDS.map((id) => runOne(id, garmentFileId)));
  const totalWallClockMs = Date.now() - fanoutStart;

  const report = {
    generatedAt: new Date().toISOString(),
    garmentFileId,
    totalWallClockMs,
    perPerson: results,
  };
  fs.writeFileSync(path.join(__dirname, "..", "panel", "vto-latency-report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== LATENCY REPORT ===");
  for (const r of results) {
    console.log(`${r.id}: ${r.status} in ${r.wallClockMs}ms`);
  }
  console.log(`TOTAL parallel fan-out wall-clock: ${totalWallClockMs}ms (${(totalWallClockMs / 1000).toFixed(1)}s)`);
}

main();
