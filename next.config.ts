import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist must run as real Node code (it resolves its worker build at
  // runtime); bundling it breaks text extraction.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
