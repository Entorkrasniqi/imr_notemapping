"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "blueprint";

const STORAGE_KEY = "notemap-theme";
const THEMES: readonly Theme[] = ["light", "dark", "blueprint"];

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always starts as "light" — deliberately matching what the server has
  // no way to avoid rendering, so React's hydration pass (the client's
  // *first* render, which must match the server's output exactly) sees
  // the same value on both sides for every consumer of this context, not
  // just for the `<html>` element the inline script touches directly.
  //
  // An earlier version lazily initialized this from
  // `document.documentElement.getAttribute('data-theme')` — which reads
  // correctly, but only because the inline script (see THEME_INIT_SCRIPT
  // below) already mutated that attribute *before* hydration ran. That
  // made the client's first render diverge from the server's for anyone
  // with a stored dark/blueprint preference, which is exactly what
  // produced the "tree hydrated but some attributes ... didn't match"
  // error — not on `<html>` itself (that one's `suppressHydrationWarning`
  // in layout.tsx already covers), but on every descendant that reads
  // `theme` from this context and renders differently because of it
  // (ThemeToggle's `aria-checked`/className among them).
  const [theme, setThemeState] = useState<Theme>("light");

  // Runs once, after hydration has already completed — so bringing React
  // state in line with whatever the inline script put on `<html>` here
  // can never itself be part of a server/client diff. This is a pure
  // *read*, not a write: the DOM attribute is already correct (that's
  // the inline script's whole job), so this only ever needs to catch
  // React's own state up to it, never the other way around.
  useEffect(() => {
    function syncFromDom() {
      const attr = document.documentElement.getAttribute("data-theme");
      if (isTheme(attr)) setThemeState(attr);
    }
    syncFromDom();
  }, []);

  // The one place that actually changes the theme — always updates
  // state, the DOM attribute, and localStorage together, so unlike the
  // mount effect above, this never needs a separate effect to sync the
  // three back up with each other.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — theme still works for this
      // page load via the DOM attribute, it just won't persist.
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}

/**
 * Inlined into `layout.tsx` as a raw, un-hydrated `<script>` that runs
 * before the page paints. Without this, the page would always render its
 * default light styles first (since that's what the server has no way to
 * know to avoid), then visibly snap to the stored theme a moment later
 * once React hydrates — a "flash of wrong theme" on every load for
 * anyone who'd picked dark or blueprint.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    if (stored === 'dark' || stored === 'blueprint') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;
