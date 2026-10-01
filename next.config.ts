import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist must run as real Node code (it resolves its worker build at
  // runtime); bundling it breaks text extraction.
  serverExternalPackages: ["pdfjs-dist"],
  // Belt-and-suspenders for serverless deployments (/var/task): nft cannot
  // statically detect pdf.mjs's dynamic `import(workerSrc)`, so ensure the
  // worker build is always traced into the deployment bundle. The static
  // import in src/lib/ocr/pdfText.ts is the primary fix; this covers any
  // route that reaches pdfjs without going through that module.
  outputFileTracingIncludes: {
    "/api/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
