"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "semanticpin_theme";
const LEGACY_STORAGE_KEY = "talent_engine_theme";
const COOKIE_NAME = "semanticpin_theme";

function getThemeCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const val = match ? match[1] : null;
  return val === "dark" || val === "light" ? val : null;
}

function setThemeCookie(t: Theme) {
  if (typeof document === "undefined") return;
  // 1 year max-age, path=/, SameSite=Lax
  document.cookie = `${COOKIE_NAME}=${t}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Check browser cookie first
    const cookieVal = getThemeCookie();
    // 2. Fall back to local storage
    const stored =
      cookieVal ||
      (localStorage.getItem(STORAGE_KEY) as Theme | null) ||
      (localStorage.getItem(LEGACY_STORAGE_KEY) as Theme | null);

    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
      applyTheme(stored);
      setThemeCookie(stored);
    } else {
      // 3. Fall back to system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme: Theme = prefersDark ? "dark" : "light";
      setThemeState(initialTheme);
      applyTheme(initialTheme);
      setThemeCookie(initialTheme);
    }
    setMounted(true);
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    if (t === "dark") {
      root.classList.add("dark");
      if (body) body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      if (body) body.classList.remove("dark");
    }
  };

  const persistTheme = (t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
      localStorage.setItem(LEGACY_STORAGE_KEY, t);
    } catch {}
    setThemeCookie(t);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    persistTheme(t);
    applyTheme(t);
  };

  const toggleTheme = () => {
    setThemeState((prevTheme) => {
      const next: Theme = prevTheme === "dark" ? "light" : "dark";
      persistTheme(next);
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
