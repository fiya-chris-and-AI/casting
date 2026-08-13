"use client";

/**
 * Extracts a dominant color from the uploaded product image, browser-side,
 * so a live run's contrast diagnosis uses the actual uploaded garment color
 * rather than the fixed demo product's color. Same center-crop-average
 * approach as scripts/extract-garment-color.mjs, reimplemented for canvas
 * since that script only runs against a known local file server-side.
 */
export function extractDominantColorFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const cropSize = Math.round(Math.min(img.width, img.height) * 0.35);
        canvas.width = cropSize;
        canvas.height = cropSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");

        const left = Math.round((img.width - cropSize) / 2);
        const top = Math.round((img.height - cropSize) / 2);
        ctx.drawImage(img, left, top, cropSize, cropSize, 0, 0, cropSize, cropSize);

        const { data } = ctx.getImageData(0, 0, cropSize, cropSize);
        let r = 0, g = 0, b = 0;
        const pixelCount = cropSize * cropSize;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        r = Math.round(r / pixelCount);
        g = Math.round(g / pixelCount);
        b = Math.round(b / pixelCount);

        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        URL.revokeObjectURL(objectUrl);
        resolve(hex);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image for color extraction"));
    };
    img.src = objectUrl;
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
