"use client";

import { useTheme, type Theme } from "@/lib/theme/theme-context";

const svg = { viewBox: "0 0 16 16", fill: "none", className: "h-3.5 w-3.5", "aria-hidden": true } as const;
const stroke = { stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function SunIcon() {
  return (
    <svg {...svg}>
      <circle cx="8" cy="8" r="2.9" {...stroke} />
      <path d="M8 1.6v1.5M8 12.9v1.5M14.4 8h-1.5M3.1 8H1.6M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6 3.5 3.5" {...stroke} />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...svg}>
      <path d="M13.4 9.6A5.6 5.6 0 0 1 6.4 2.6a5.6 5.6 0 1 0 7 7Z" {...stroke} />
    </svg>
  );
}

/** A drafting grid, for blueprint mode. */
function GridIcon() {
  return (
    <svg {...svg}>
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1" {...stroke} />
      <path d="M2.25 6.1h11.5M2.25 9.9h11.5M6.1 2.25v11.5M9.9 2.25v11.5" {...stroke} strokeOpacity={0.7} />
    </svg>
  );
}

const OPTIONS: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "blueprint", label: "Blueprint", icon: <GridIcon /> },
];

/**
 * The three themes as a small joined control — one bordered box with a
 * divider between the options, the selected one shaded — rather than a
 * floating pill. Rendered in the Dashboard and Board toolbars so the choice
 * is reachable everywhere; `useTheme` reads and writes the same shared state
 * (backed by `data-theme` + localStorage, see theme-context.tsx).
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex h-[26px] overflow-hidden rounded border border-(--zt-field-border) bg-(--zt-field)">
      {OPTIONS.map((option, index) => {
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={`flex w-7 items-center justify-center text-(--zt-dim) transition-colors hover:text-(--zt-text) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--zt-accent) ${
              index > 0 ? "border-l border-(--zt-field-border)" : ""
            } ${isActive ? "bg-(--zt-hover) text-(--zt-text)" : ""}`}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
