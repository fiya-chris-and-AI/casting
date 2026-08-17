// Build-time translation generator — NOT run at request time.
// Reads locales/en.json, calls Claude Haiku once per target language with the
// whole JSON in a single request, writes locales/<code>.json. Generated files
// are committed so translations are auditable in the repo.
//
// Usage: node scripts/translate-locales.mjs [--only=zh-TW,de] [--review-zh-tw-only]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APP_ROOT, "..");
const LOCALES_DIR = path.join(APP_ROOT, "locales");
const MODEL = "claude-haiku-4-5";

// Locale list matches yce.perfectcorp.com. zh-TW is the jury's language (Perfect
// Corp, New Taipei City) and gets a second native-speaker review pass below.
const TARGET_LOCALES = ["zh-TW", "zh-CN", "ja", "ko", "es", "pt", "fr", "de", "it", "th", "id", "vi", "tr", "ru", "nl", "pl"];

const LOCALE_NAMES = {
  "zh-TW": "Traditional Chinese (Taiwan)",
  "zh-CN": "Simplified Chinese (Mainland China)",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  th: "Thai",
  id: "Indonesian",
  vi: "Vietnamese",
  tr: "Turkish",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
};

function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const candidates = [path.join(REPO_ROOT, ".env.local"), path.join(APP_ROOT, ".env.local")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.startsWith("ANTHROPIC_API_KEY="));
    if (line) return line.slice("ANTHROPIC_API_KEY=".length).trim();
  }
  throw new Error("ANTHROPIC_API_KEY not found in env or .env.local (repo root or casting-app/). Key must never be committed.");
}

const GLOSSARY = `
Translate every single value in the JSON below into the target language. There are no exceptions by content — only the specific untranslated tokens named in rule 5 stay as-is; everything else, including every sentence about the panel, the sample, or contrast, must come out in the target language.

Meaning rules for specific keys (translate these keys' values fully into the target language, applying the stated meaning constraint):
1. Keys about the measured-bands list (e.g. coverage.measured, methods.sampleP1Lead, report.measurableBandsBody): the source names four specific bands. Keep that as four specific named items in translation — do not turn it into a range phrasing or an "all bands" claim.
2. Keys about unmeasured bands (e.g. coverage.notMeasurable, methods.sampleP1Gap, report.notMeasurableWithPanel): translate so the meaning stays "genuinely not measured" — never translate this as equivalent to "covered" or "included".
3. Keys about the sample-vs-population point (e.g. methods.sampleP2Bold, report.footnote): translate the full sentence into the target language, preserving that eight people are a sample, not a statistical population. Do not leave this sentence in English.
4. Keys about contrast (e.g. tile.lowContrast, coverage.lowContrastAt, methods.thresholdP2Mid, report.diagnosisLowContrast, diagnosis.lowContrast): translate using a plain technical register, not dramatic or alarming language.
5. The ONLY untranslated tokens allowed anywhere: placeholders in curly braces ({band}, {hex}, {dl}, {de}, {bands}, {threshold}, {date} — copy exactly, never rename), and the terms "Fitzpatrick", "ΔL*", "ΔE2000", "CASTING", "MERIDIAN GOODS", and hex color codes.
6. Overall tone: matter-of-fact and technical, never marketing language, no added exclamation points.
`.trim();

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

async function callForJson(client, system, user) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("no text block in response");
  return extractJson(textBlock.text);
}

const JSON_ONLY_INSTRUCTION =
  "Return ONLY the JSON object — no markdown code fences, no explanation, no preamble or postamble text.";

async function translateOne(client, code, enJson) {
  const name = LOCALE_NAMES[code];
  const system = `You are a professional UI translator localizing a measurement/analytics product's interface into ${name} (locale code "${code}"). ${GLOSSARY}`;
  const user = `Translate every value in this JSON object from English into ${name}. Keys must stay identical — same set of keys, same order. ${JSON_ONLY_INSTRUCTION}\n\n${JSON.stringify(enJson, null, 2)}`;
  try {
    return await callForJson(client, system, user);
  } catch {
    // One retry with a sharper reminder — malformed JSON or a stray fence is the usual cause.
    return await callForJson(client, system, `${user}\n\nReminder: valid JSON only, matching every key from the source exactly.`);
  }
}

async function reviewZhTW(client, translated) {
  const system = `You are a native Traditional Chinese (Taiwan) speaker reviewing a UI translation for a measurement/analytics product. ${GLOSSARY}`;
  const user = `Review this Traditional Chinese (Taiwan) translation as a native speaker. Correct any mistranslation, awkward phrasing, or Simplified-Chinese-leaning wording; keep technical terms and placeholders untouched per the glossary. Return the corrected JSON object with the same keys. ${JSON_ONLY_INSTRUCTION}\n\n${JSON.stringify(translated, null, 2)}`;
  try {
    return await callForJson(client, system, user);
  } catch {
    return await callForJson(client, system, `${user}\n\nReminder: valid JSON only, matching every key from the source exactly.`);
  }
}

function validateKeys(code, enKeys, translated) {
  const missing = enKeys.filter((k) => !(k in translated));
  const extra = Object.keys(translated).filter((k) => !enKeys.includes(k));
  if (missing.length || extra.length) {
    throw new Error(`${code}: key mismatch — missing [${missing.join(", ")}] extra [${extra.join(", ")}]`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;
  const reviewOnly = args.includes("--review-zh-tw-only");

  const enJson = JSON.parse(readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
  const enKeys = Object.keys(enJson);

  const client = new Anthropic({ apiKey: loadApiKey() });

  if (reviewOnly) {
    const current = JSON.parse(readFileSync(path.join(LOCALES_DIR, "zh-TW.json"), "utf8"));
    console.log("Reviewing zh-TW as native speaker…");
    const reviewed = await reviewZhTW(client, current);
    validateKeys("zh-TW", enKeys, reviewed);
    writeFileSync(path.join(LOCALES_DIR, "zh-TW.json"), JSON.stringify(reviewed, null, 2) + "\n");
    console.log("zh-TW review written.");
    return;
  }

  const locales = only ?? TARGET_LOCALES;

  for (const code of locales) {
    if (!TARGET_LOCALES.includes(code)) {
      console.warn(`Skipping unknown locale "${code}"`);
      continue;
    }
    console.log(`Translating ${code} (${LOCALE_NAMES[code]})…`);
    let translated = await translateOne(client, code, enJson);
    validateKeys(code, enKeys, translated);

    if (code === "zh-TW") {
      console.log("  zh-TW: running native-speaker review pass (jury language)…");
      translated = await reviewZhTW(client, translated);
      validateKeys(code, enKeys, translated);
    }

    writeFileSync(path.join(LOCALES_DIR, `${code}.json`), JSON.stringify(translated, null, 2) + "\n");
    console.log(`  wrote locales/${code}.json`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
