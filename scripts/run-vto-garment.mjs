// Video-asset production: run one 8-person Clothes-VTO fan-out for an arbitrary garment.
// Unlike run-vto-fanout.mjs (which seeds the app and overwrites panel/vto-results/),
// this writes to panel/video-vto/<slug>/ so the app's seed data is never touched.
// Duplicates the upload/poll helpers from run-vto-fanout.mjs on purpose: scripts in
// this folder are standalone by convention (no shared module, no extra deps).
//
// Usage:
//   node scripts/run-vto-garment.mjs --garment panel/product-images/product-houndstooth-blazer.png \
//        --category outerwear [--slug houndstooth-blazer] [--dry-run]
//
// Cost: 8 successful cloth-v4 tasks x 2 units = 16 units per run. Failures are not
// billed; one retry per failed person (a successful retry replaces the failure, so
// billed successes never exceed 8). Aborts if balance < MIN_BALANCE.

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, "..");

// dotenv is not a dependency of this app (Next loads .env natively), so parse by hand.
function loadEnvLocal() {
  const envPath = path.join(APP_DIR, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(`.env.local not found at ${envPath}`);
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
loadEnvLocal();

const BASE_URL = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
// Default to the primary key; YOUCAM_ACCOUNT=backup switches explicitly.
// (run-vto-fanout.mjs's ternary picks the empty backup key when YOUCAM_ACCOUNT is unset.)
const API_KEY =
  process.env.YOUCAM_ACCOUNT === "backup" ? process.env.YOUCAM_API_KEY_BACKUP : process.env.YOUCAM_API_KEY;
const MIN_BALANCE = 24; // never start a 16-unit run without headroom
// Enum per lib/youcam/endpoints.ts (verified in production): docs say "outerwear" but the API wants "outer".
const VALID_CATEGORIES = ["upper_body", "lower_body", "full_body", "outer", "shoes", "auto"];

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--garment") args.garment = argv[++i];
    else if (argv[i] === "--category") args.category = argv[++i];
    else if (argv[i] === "--slug") args.slug = argv[++i];
    else if (argv[i] === "--persons") args.persons = argv[++i].split(",");
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.garment) throw new Error("Missing --garment <path>");
  if (!args.category) throw new Error(`Missing --category <${VALID_CATEGORIES.join("|")}>`);
  if (!VALID_CATEGORIES.includes(args.category)) throw new Error(`Invalid category: ${args.category}`);
  if (!args.slug) args.slug = path.basename(args.garment).replace(/^product-/, "").replace(/\.[a-z]+$/i, "");
  return args;
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

async function getBalance() {
  const res = await youcamFetch("/s2s/v1.0/client/credit");
  const rows = res?.results ?? [];
  return rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
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
    if (data?.task_status === "error") throw new Error(`Task failed: ${JSON.stringify(data)}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Task ${taskPath} timed out polling`);
}

const PANEL_IDS = ["person-01", "person-02", "person-03", "person-04", "person-05", "person-06", "person-07", "person-08"];
const BODY_DIR = path.join(APP_DIR, "panel", "body-images");

async function runOne(id, garmentFileId, category, resultDir) {
  const t0 = Date.now();
  const bodyBytes = fs.readFileSync(path.join(BODY_DIR, `${id}.png`));
  const person = await uploadFile(bodyBytes, `${id}.png`, "image/png");
  const results = await runTask("/s2s/v2.0/task/cloth-v4", {
    src_file_id: person,
    ref_file_id: garmentFileId,
    garment_category: category,
  });
  const remoteUrl = results?.url;
  if (!remoteUrl) throw new Error(`No result url: ${JSON.stringify(results)}`);
  const imgRes = await fetch(remoteUrl); // result URLs expire in 2h -> download immediately
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
  fs.writeFileSync(path.join(resultDir, `${id}.jpg`), Buffer.from(await imgRes.arrayBuffer()));
  return Date.now() - t0;
}

async function main() {
  const args = parseArgs(process.argv);
  const garmentPath = path.isAbsolute(args.garment) ? args.garment : path.join(APP_DIR, args.garment);

  if (!API_KEY) throw new Error("No API key resolved (check YOUCAM_ACCOUNT / YOUCAM_API_KEY in .env.local)");
  if (!fs.existsSync(garmentPath)) throw new Error(`Garment image not found: ${garmentPath}`);
  const stat = fs.statSync(garmentPath);
  if (stat.size >= 10 * 1024 * 1024) throw new Error(`Garment image is ${stat.size} bytes; API limit is 10MB`);
  const ext = path.extname(garmentPath).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) throw new Error(`Garment must be png/jpg, got ${ext}`);

  const balanceBefore = await getBalance();
  console.log(`slug=${args.slug} category=${args.category} garment=${path.basename(garmentPath)}`);
  console.log(`balance before: ${balanceBefore} units (run will consume up to 16)`);
  if (balanceBefore < MIN_BALANCE) throw new Error(`Balance ${balanceBefore} below safety floor ${MIN_BALANCE}; aborting`);

  if (args.dryRun) {
    console.log("DRY RUN: environment, garment file, and balance all OK. No tasks started, 0 units spent.");
    return;
  }

  const resultDir = path.join(APP_DIR, "panel", "video-vto", args.slug);
  fs.mkdirSync(resultDir, { recursive: true });

  const contentType = ext === ".png" ? "image/png" : "image/jpeg";
  const garmentFileId = await uploadFile(fs.readFileSync(garmentPath), path.basename(garmentPath), contentType);
  console.log("garment file_id:", garmentFileId);

  const runIds = args.persons ?? PANEL_IDS;
  const invalid = runIds.filter((id) => !PANEL_IDS.includes(id));
  if (invalid.length) throw new Error(`Unknown person ids: ${invalid.join(",")}`);

  const t0 = Date.now();
  const outcomes = await Promise.all(
    runIds.map(async (id) => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const ms = await runOne(id, garmentFileId, args.category, resultDir);
          console.log(`[${id}] OK in ${ms}ms${attempt > 1 ? " (retry)" : ""}`);
          return { id, status: "success", ms, attempt };
        } catch (err) {
          console.error(`[${id}] attempt ${attempt} FAILED: ${err.message}`);
          if (attempt === 2) return { id, status: "error", error: err.message };
        }
      }
    })
  );
  const totalMs = Date.now() - t0;

  const balanceAfter = await getBalance();
  const report = {
    generatedAt: new Date().toISOString(),
    slug: args.slug,
    garment: path.basename(garmentPath),
    category: args.category,
    totalWallClockMs: totalMs,
    unitsBefore: balanceBefore,
    unitsAfter: balanceAfter,
    unitsSpent: balanceBefore - balanceAfter,
    perPerson: outcomes,
  };
  fs.writeFileSync(path.join(resultDir, "run-report.json"), JSON.stringify(report, null, 2));

  const ok = outcomes.filter((o) => o.status === "success").length;
  console.log(`\n${ok}/${runIds.length} succeeded in ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`units: ${balanceBefore} -> ${balanceAfter} (spent ${balanceBefore - balanceAfter})`);
  console.log(`results in panel/video-vto/${args.slug}/`);
  if (ok < runIds.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(2);
});
