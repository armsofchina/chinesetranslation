import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(
  new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)
);
const destination = fileURLToPath(new URL("../public/pdf.worker.min.mjs", import.meta.url));

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
