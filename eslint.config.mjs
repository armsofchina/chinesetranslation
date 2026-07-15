import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const config = [
  { ignores: [".next/**", "node_modules/**", "public/pdf.worker.min.mjs", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Source previews use local data/blob URLs, which next/image cannot optimize.
      "@next/next/no-img-element": "off"
    }
  }
];

export default config;
