# Chinese PDF/Text Translator

A polished Next.js MVP for translating Traditional and Simplified Chinese text into clean English.

## Features

- Upload Chinese PDF files and extract selectable text using PDF.js
- Detect scanned/image-only PDFs and show a clear OCR notice
- Paste Chinese text directly and translate without uploading files
- Translate through PPQ using a secure backend route
- Use default server API key or optional user-provided PPQ key
- Switch between Original Chinese, English Translation, and Side-by-side views
- Copy full English translation in one click
- Download translation as TXT or PDF
- Light, dark, and system theme support with local preference persistence

## Tech Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS (`darkMode: "class"`)
- `pdfjs-dist` for PDF text extraction
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
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional compatibility aliases:

```env
OPENROUTER_API_KEY=... # used only as fallback if PPQ_API_KEY is unset
OPENROUTER_MODEL=...   # used only as fallback if PPQ_MODEL is unset
```

4. Run the dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## API Key Behavior

- Default mode: backend uses `PPQ_API_KEY` from server environment.
- User mode: user enters key in UI and it overrides default key for that request.
- User key is never stored server-side.
- User key is only saved in browser localStorage when "Remember my key on this device" is checked.
- If no key is available, API returns:

`No PPQ API key is configured. Add a key in settings or configure PPQ_API_KEY on the server.`

## Safe Deployment Notes

- Keep `PPQ_API_KEY` only in server environment variables.
- Never expose `PPQ_API_KEY` via `NEXT_PUBLIC_*` variables.
- Do not log API keys in server logs or client logs.
- Use HTTPS in production.
- Uploaded files are handled in-memory for extraction and are not persisted by the app.
# chinesetranslation
