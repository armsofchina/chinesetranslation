# Chinese PDF/Text Translator

A polished Next.js MVP for translating Traditional and Simplified Chinese text into clean English.

## Features

- Upload Chinese PDF files and extract selectable text using PDF.js
- Detect scanned/image-only PDFs and show a clear OCR notice
- Paste Chinese text directly and translate without uploading files
- Translate through OpenRouter using a secure backend route
- Use default server API key or optional user-provided OpenRouter key
- Switch between Original Chinese, English Translation, and Side-by-side views
- Copy full English translation in one click
- Download translation as TXT or PDF
- Light, dark, and system theme support with local preference persistence

## Tech Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS (`darkMode: "class"`)
- `pdfjs-dist` for PDF text extraction
- OpenRouter chat completions API
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
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=openai/gpt-4.1-mini
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. Run the dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## API Key Behavior

- Default mode: backend uses `OPENROUTER_API_KEY` from server environment.
- User mode: user enters key in UI and it overrides default key for that request.
- User key is never stored server-side.
- User key is only saved in browser localStorage when "Remember my key on this device" is checked.
- If no key is available, API returns:

`No OpenRouter API key is configured. Add a key in settings or configure OPENROUTER_API_KEY on the server.`

## Safe Deployment Notes

- Keep `OPENROUTER_API_KEY` only in server environment variables.
- Never expose `OPENROUTER_API_KEY` via `NEXT_PUBLIC_*` variables.
- Do not log API keys in server logs or client logs.
- Use HTTPS in production.
- Uploaded files are handled in-memory for extraction and are not persisted by the app.
# chinesetranslation
