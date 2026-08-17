import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productPath = path.join(__dirname, "..", "panel", "product-images", "demo-product-navy-shirt.png");

// The flat-lay product photo has the garment filling the center of the frame
// against a light-gray background. Sample a center crop (well inside the
// garment, away from background/edges) and average pixel color — dominant
// textile color, not contaminated by background or shadow.
const meta = await sharp(productPath).metadata();
const { width, height } = meta;
const cropSize = Math.round(Math.min(width, height) * 0.35);
const left = Math.round((width - cropSize) / 2);
const top = Math.round((height - cropSize) / 2);

const { data, info } = await sharp(productPath)
  .extract({ left, top, width: cropSize, height: cropSize })
  .raw()
  .toBuffer({ resolveWithObject: true });

let r = 0, g = 0, b = 0;
const pixelCount = info.width * info.height;
for (let i = 0; i < data.length; i += info.channels) {
  r += data[i];
  g += data[i + 1];
  b += data[i + 2];
}
r = Math.round(r / pixelCount);
g = Math.round(g / pixelCount);
b = Math.round(b / pixelCount);

const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const out = {
  extractedAt: new Date().toISOString(),
  method: "center-crop average, 35% of min(width,height), from panel/product-images/demo-product-navy-shirt.png",
  rgb: { r, g, b },
  hex,
};

const outPath = path.join(__dirname, "..", "panel", "garment-color.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}`);
