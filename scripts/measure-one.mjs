import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const BASE_URL = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
const API_KEY = process.env.YOUCAM_API_KEY;
const id = process.argv[2];
if (!id) {
  console.error("Usage: node measure-one.mjs <panel-id>");
  process.exit(1);
}

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

const bytes = fs.readFileSync(path.join(__dirname, "..", "panel", "source-images", `${id}.png`));
const fileId = await uploadFile(bytes, `${id}.png`, "image/png");
console.log("fileId", fileId);

const fitz = await runTask("/s2s/v2.0/task/fitzpatrick-scale-analyzer", { src_file_id: fileId, version: "1.0" });
console.log("fitzpatrick", fitz);

const tone = await runTask("/s2s/v2.0/task/skin-tone-analysis", { src_file_id: fileId });
console.log("tone", tone);
