import { ThemePreference } from "@/lib/types";

export const THEME_STORAGE_KEY = "translator-theme";

export const getSavedThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
};

export const applyThemePreference = (preference: ThemePreference): void => {
  if (typeof window === "undefined") {
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = preference === "dark" || (preference === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", useDark);
};

export const saveThemePreference = (preference: ThemePreference): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
};
