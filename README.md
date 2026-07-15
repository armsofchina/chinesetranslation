# Chinese Document Translator

A polished Next.js MVP for translating Traditional and Simplified Chinese text into clean English.

## Features

- Upload PDF, DOCX, EPUB, and PowerPoint (`.pptx`) files
- Preserve headings, lists, tables, DOCX section order, EPUB reading-spine order, and PowerPoint slide order
- Reconstruct selectable PDF text from coordinates and remove repeated page headers/footers
- OCR + translate scanned/image-only PDF pages using PPQ vision models
- Upload images (PNG/JPG/WEBP/BMP/TIFF) and translate non-selectable text
- Paste Chinese text directly and translate without uploading files
- Translate through PPQ using a secure backend route
- Use default server API key or optional user-provided PPQ key
- Switch between Original Chinese, English Translation, and Side-by-side views
- Jump directly to a page, section, chapter, or slide and search Chinese and English side-by-side text with highlighted match navigation
- Copy full English translation in one click
- Run deterministic per-segment QA for dates, numbers, percentages, currency, glossary terms, and source leakage
- Review, annotate, approve, or retranslate individual segments
- Reuse exact approved translations from on-device translation memory
- Edit/import/export bilingual glossaries; AI term analysis is opt-in
- Download as TXT, PDF, bilingual HTML, or bilingual DOCX
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
OPENROUTER_SESSION_SECRET=replace-with-at-least-32-random-characters
OPENROUTER_ALLOWED_MODELS=
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
- Connected OpenRouter keys are encrypted into an HttpOnly, Secure production session cookie and are not exposed to page JavaScript. Configure `OPENROUTER_SESSION_SECRET` in production.
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
- Set a unique, high-entropy `OPENROUTER_SESSION_SECRET`; rotating it invalidates existing OpenRouter connections.
- Use `OPENROUTER_ALLOWED_MODELS` as a comma-separated allowlist when deployments need model/cost controls.
- Translation requests have schema, size, rate, and two-minute upstream timeout limits. Multi-instance deployments should replace the in-process rate limiter with a shared store.
- Uploaded files and workspace progress are stored locally in IndexedDB for recovery and are not uploaded by the extraction pipeline.
- Legacy binary `.ppt` files must be saved as `.pptx` before upload.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
