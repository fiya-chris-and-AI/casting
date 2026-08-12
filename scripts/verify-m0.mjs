import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const required = ["YOUCAM_API_KEY", "YOUCAM_SECRET_KEY", "YOUCAM_API_BASE_URL"];
const missing = required.filter((k) => !process.env[k] || process.env[k].trim() === "");

if (missing.length > 0) {
  console.log("MISSING:", missing.join(", "));
  process.exit(1);
}

console.log("ALL PRESENT — key lengths:", required.map((k) => `${k}=${process.env[k].length}chars`).join(", "));
