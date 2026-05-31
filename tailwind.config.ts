import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f7fb",
          100: "#e8eef8",
          200: "#c9d8f0",
          300: "#a3bfe5",
          700: "#244265",
          800: "#1a314b",
          900: "#122236"
        }
      },
      boxShadow: {
        soft: "0 12px 40px rgba(18, 34, 54, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
