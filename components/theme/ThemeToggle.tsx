"use client";

import { useTheme, type Theme } from "@/lib/theme/theme-context";

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth={1.3} />
      <path
        d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M13.5 9.7A5.7 5.7 0 0 1 6.3 2.5a5.7 5.7 0 1 0 7.2 7.2Z"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A drafting grid — blueprint mode's "engineering" mark, echoing the
 * theme's own graph-paper background rather than risking an icon that
 * reads as a letter at this size (an earlier compass glyph did exactly
 * that — looked like a plain "A"). */
function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth={1.2} />
      <path d="M2 6.7h12M2 11.3h12M6.7 2v12M11.3 2v12" stroke="currentColor" strokeWidth={1} strokeOpacity={0.7} />
    </svg>
  );
}

const OPTIONS: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "blueprint", label: "Blueprint", icon: <GridIcon /> },
];

/**
 * A compact three-way segmented control for the app's three themes.
 * Rendered in both the Dashboard and Board headers so the choice is
 * reachable everywhere, not just from one screen — `useTheme` reads and
 * writes the same shared state (backed by `data-theme` + localStorage,
 * see theme-context.tsx) regardless of which instance is used.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-white/10 dark:bg-white/5 blueprint:border-white/20 blueprint:bg-white/10"
    >
      {OPTIONS.map((option) => {
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 blueprint:bg-white blueprint:text-[#0f3057]"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white blueprint:text-white/50 blueprint:hover:bg-white/10 blueprint:hover:text-white"
            }`}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
