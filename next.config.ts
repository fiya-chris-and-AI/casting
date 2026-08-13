import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // /api/export/zip reads panel/vto-results/*.jpg directly off disk (not
  // via self-fetch) — this guarantees those static assets are actually
  // bundled into that route's deployed serverless function.
  outputFileTracingIncludes: {
    "/api/export/zip": ["./public/panel/vto-results/**"],
  },
};

export default nextConfig;
