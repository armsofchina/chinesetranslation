import type { Metadata } from "next";
import "./globals.css";

const themeInitScript = `
(() => {
  const THEME_KEY = "translator-theme";
  const stored = localStorage.getItem(THEME_KEY) || "system";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = stored === "dark" || (stored === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", useDark);
})();
`;

export const metadata: Metadata = {
  title: "Chinese PDF/Text Translator",
  description:
    "Upload Chinese PDFs or paste text to generate clean English translations with PPQ."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
