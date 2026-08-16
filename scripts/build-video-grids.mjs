// Video-asset production: composite one garment's 8 VTO results into a full-bleed
// 4x2 grid (3840x2160) for the demo video's Opening/Lookbook scenes. Title and
// captions are added later in Claude Design as text layers, so grids stay clean.
// Uses sharp from node_modules (present as a Next.js dependency; no new deps added).
//
// Usage:
//   node scripts/build-video-grids.mjs --input panel/video-vto/houndstooth-blazer --slug houndstooth-blazer
//   node scripts/build-video-grids.mjs --input panel/vto-results --slug demo-tee   (0-unit layout test)
//
// Output: <repo-root>/video/grids/grid-<slug>.jpg

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(APP_DIR, "..", "video", "grids");

const CANVAS_W = 3840;
const CANVAS_H = 2160;
const GUTTER = 8; // matches the thin light seams of the in-app board
const COLS = 4;
const ROWS = 2;
const GUTTER_COLOR = "#f5f4f2"; // CASTING paper tone (brand token)
const CELL_W = (CANVAS_W - GUTTER * (COLS - 1)) / COLS; // 954
const CELL_H = (CANVAS_H - GUTTER * (ROWS - 1)) / ROWS; // 1076

const PANEL_IDS = ["person-01", "person-02", "person-03", "person-04", "person-05", "person-06", "person-07", "person-08"];

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    else if (argv[i] === "--slug") args.slug = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.input) throw new Error("Missing --input <dir with person-01..08 images>");
  if (!args.slug) args.slug = path.basename(args.input);
  return args;
}

function findTile(dir, id) {
  for (const ext of [".jpg", ".jpeg", ".png"]) {
    const p = path.join(dir, `${id}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Missing tile ${id}.(jpg|png) in ${dir}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const inputDir = path.isAbsolute(args.input) ? args.input : path.join(APP_DIR, args.input);
  const tiles = PANEL_IDS.map((id) => findTile(inputDir, id));

  const composites = [];
  for (let i = 0; i < tiles.length; i++) {
    // position:"top" keeps full headroom; the crop comes out of the lower torso
    const buf = await sharp(tiles[i])
      .resize(Math.round(CELL_W), Math.round(CELL_H), { fit: "cover", position: "top" })
      .toBuffer();
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    composites.push({
      input: buf,
      left: Math.round(col * (CELL_W + GUTTER)),
      top: Math.round(row * (CELL_H + GUTTER)),
    });
  }

  fs.mkdirSync(args.out, { recursive: true });
  const outPath = path.join(args.out, `grid-${args.slug}.jpg`);
  await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: GUTTER_COLOR },
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toFile(outPath);

  console.log(`grid written: ${outPath} (${CANVAS_W}x${CANVAS_H}, tiles from ${inputDir})`);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(2);
});
