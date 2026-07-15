# Chinese Document Translator

A polished Next.js MVP for translating Traditional and Simplified Chinese text into clean English.

## Features

- Upload PDF, DOCX, EPUB, and PowerPoint (`.pptx`) files
- Preserve DOCX section order, EPUB reading-spine order, and PowerPoint slide order
- Extract selectable PDF text using PDF.js
- OCR + translate scanned/image-only PDF pages using PPQ vision models
- Upload images (PNG/JPG/WEBP/BMP/TIFF) and translate non-selectable text
- Paste Chinese text directly and translate without uploading files
- Translate through PPQ using a secure backend route
- Use default server API key or optional user-provided PPQ key
- Switch between Original Chinese, English Translation, and Side-by-side views
- Jump directly to a page, section, chapter, or slide and search Chinese and English side-by-side text with highlighted match navigation
- Copy full English translation in one click
- Download translation as TXT or PDF
- Light, dark, and system theme support with local preference persistence

## Tech Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS (`darkMode: "class"`)
- `pdfjs-dist` for PDF text extraction
- `jszip` for DOCX, EPUB, and PPTX extraction
- PPQ OpenAI-compatible chat completions API
- `jspdf` for English PDF export

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.local.example .env.local
```

3. Add your default server key to `.env.local`:

```env
PPQ_API_KEY=your_ppq_key_here
PPQ_MODEL=claude-sonnet-4-5
PPQ_VISION_MODEL=private/qwen3-vl-30b
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_VISION_MODEL=openrouter/free
OPENROUTER_APP_NAME=Translation Vibe
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For hosted deployments, set `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin (for example, `https://translate.example.com`) or leave it unset so the app uses the request origin. Do not leave it set to `http://localhost:3000` in a hosted production environment.

4. Run the dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Provider and API Key Behavior

- PPQ supports a shared server `PPQ_API_KEY` or an optional personal key entered in settings.
- OpenRouter supports a shared server `OPENROUTER_API_KEY` or one-click account connection using OAuth PKCE.
- Connected OpenRouter keys are stored in the user's browser local storage and sent with OpenRouter translation requests.
- The OpenRouter model selector defaults to `openrouter/free`, lists pinned `:free` models first, and clearly separates standard models that may use account credits.
- Model choices are saved with the local workspace. OCR uses `OPENROUTER_VISION_MODEL` or the automatic free vision route so text-only model selections do not break scanned documents.
- The selected provider is saved with the local workspace and used for translation, OCR, and glossary extraction.
- Personal PPQ keys are saved in browser localStorage only when "Remember my key on this device" is checked.
- If no key is available, API returns:

`Add a PPQ key in settings or configure PPQ_API_KEY on the server.`

## Safe Deployment Notes

- Keep `PPQ_API_KEY` only in server environment variables.
- Keep a shared `OPENROUTER_API_KEY`, if configured, only in server environment variables.
- Never expose `PPQ_API_KEY` via `NEXT_PUBLIC_*` variables.
- Do not log API keys in server logs or client logs.
- Use HTTPS in production.
- Browser-stored OpenRouter keys are accessible to JavaScript running on the same origin. Keep dependencies current, use a restrictive content security policy, and avoid third-party scripts.
- Uploaded files and workspace progress are stored locally in IndexedDB for recovery and are not uploaded by the extraction pipeline.
- Legacy binary `.ppt` files must be saved as `.pptx` before upload.
# chinesetranslation
