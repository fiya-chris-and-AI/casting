import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const BASE_URL = process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.perfectcorp.com";

async function checkCredit(label, apiKey) {
  if (!apiKey) {
    console.log(`${label}: no key set`);
    return;
  }
  try {
    const res = await fetch(`${BASE_URL}/s2s/v1.0/client/credit`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    console.log(`${label}: HTTP ${res.status} — ${text}`);
  } catch (err) {
    console.log(`${label}: ERROR — ${err.message}`);
  }
}

await checkCredit("PRIMARY", process.env.YOUCAM_API_KEY);
await checkCredit("BACKUP", process.env.YOUCAM_API_KEY_BACKUP);
