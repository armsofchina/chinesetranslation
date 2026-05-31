import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-ui" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-doc" });

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
    "Upload Chinese PDFs or paste text to generate clean English translations with OpenRouter."
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
      <body className={`${manrope.variable} ${sourceSerif.variable}`}>{children}</body>
    </html>
  );
}
