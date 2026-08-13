import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "panel", "source-images");

const IDS = [
  "person-01",
  "person-02",
  "person-03",
  "person-04",
  "person-05",
  "person-06",
  "person-07",
  "person-08",
];

async function cropOne(id) {
  const srcPath = path.join(DIR, `${id}.png`);
  const meta = await sharp(srcPath).metadata();
  const { width, height } = meta;

  // Source images are 3:4 head-and-shoulders shots with the face roughly in
  // the top half. Crop a tight square centered horizontally, top-anchored,
  // so the face fills most of the frame for the face-detection APIs.
  const cropSize = Math.round(width * 0.9);
  const left = Math.round((width - cropSize) / 2);
  const top = 0;

  const outPath = path.join(DIR, `${id}.png`);
  const buffer = await sharp(srcPath)
    .extract({ left, top, width: cropSize, height: Math.min(cropSize, height) })
    .resize(1024, 1024, { fit: "cover" })
    .png()
    .toBuffer();

  fs.writeFileSync(outPath, buffer);
  console.log(`[${id}] cropped ${width}x${height} -> 1024x1024 (square ${cropSize}px from top)`);
}

for (const id of IDS) {
  await cropOne(id);
}
