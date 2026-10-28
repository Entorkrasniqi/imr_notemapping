// Small stroke icons for the files sidebar and PDF reader, in the same
// 16px / 1.3 stroke style as ThemeToggle's. `currentColor` throughout so
// each theme and the selected-row highlight recolor them for free.

type IconProps = { className?: string };

const base = { viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
const stroke = { stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function PdfFileIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 1.75h5.2L12.5 5v8.25a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <path d="M9 1.9V5h3.3" {...stroke} />
      <path d="M5.2 11.4h5.6" {...stroke} />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 3.25v9.5M3.25 8h9.5" {...stroke} />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 4l8 8M12 4l-8 8" {...stroke} />
    </svg>
  );
}

export function ChevronIcon({ className = "h-4 w-4", direction }: IconProps & { direction: "left" | "right" | "up" | "down" }) {
  const path = {
    left: "M9.75 3.5 5.25 8l4.5 4.5",
    right: "M6.25 3.5 10.75 8l-4.5 4.5",
    up: "M3.5 9.75 8 5.25l4.5 4.5",
    down: "M3.5 6.25 8 10.75l4.5-4.5",
  }[direction];
  return (
    <svg {...base} className={className}>
      <path d={path} {...stroke} />
    </svg>
  );
}

export function PencilIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m10.6 2.9 2.5 2.5-7.4 7.4-3.1.6.6-3.1 7.4-7.4Z" {...stroke} />
    </svg>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.75 4.25h10.5M6.25 4.25v-1.5h3.5v1.5M4.1 4.25l.6 8.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.6-8.5" {...stroke} />
    </svg>
  );
}

export function SpinnerIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={`${className} animate-spin`}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.6} />
      <path d="M13.5 8A5.5 5.5 0 0 0 8 2.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

/** Two stacked sheets — the collapsed sidebar's "Files" button. */
export function FilesIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 2.75h4.7l2.8 2.8v6.2a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" {...stroke} />
      <path d="M3.25 5v7.5a1 1 0 0 0 1 1H11" {...stroke} />
    </svg>
  );
}

export function ImageFileIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.25" y="3" width="11.5" height="10" rx="1.25" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <circle cx="5.75" cy="6.5" r="1.1" {...stroke} />
      <path d="m2.5 12 3.4-3.2 2.4 2.2 2-1.8 3 2.8" {...stroke} />
    </svg>
  );
}

/** A page of lines — plain text and Markdown. */
export function TextFileIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 1.75h5.2L12.5 5v8.25a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <path d="M9 1.9V5h3.3M5.2 7.5h5.6M5.2 9.5h5.6M5.2 11.5h3.4" {...stroke} />
    </svg>
  );
}

/** A page with a heading bar — Word documents. */
export function WordFileIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 1.75h5.2L12.5 5v8.25a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <path d="M9 1.9V5h3.3" {...stroke} />
      <path d="M5.2 7.4h5.6" {...stroke} strokeWidth={2} />
      <path d="M5.2 10.2h5.6M5.2 12h3" {...stroke} />
    </svg>
  );
}

/** A presentation board on a stand — PowerPoint. */
export function SlidesIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="2.75" width="12" height="7.5" rx="1" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <path d="M8 10.25v2.5M5.5 13.5 8 12.75l2.5.75" {...stroke} />
      <path d="M4.75 8.2 6.5 6.3l1.4 1.3 1.6-2 1.75 2.6" {...stroke} />
    </svg>
  );
}

export function BookIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 4.2C6.9 3.2 5 2.9 2.5 3v8.8c2.5-.1 4.4.2 5.5 1.2 1.1-1 3-1.3 5.5-1.2V3C11 2.9 9.1 3.2 8 4.2Z" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <path d="M8 4.2V13" {...stroke} />
    </svg>
  );
}

export function LinkIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.7.7" {...stroke} />
      <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.7-.7" {...stroke} />
    </svg>
  );
}

/** An arrow leaving a box — "opens in a new tab". */
export function ExternalIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 2.75h4.25V7M13.25 2.75 7.5 8.5M11.5 9.5v2.75a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h2.75" {...stroke} />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="7" cy="7" r="4.25" {...stroke} />
      <path d="m10.2 10.2 3.3 3.3" {...stroke} />
    </svg>
  );
}

/** The small solid triangle Zotero's column headers use for sort direction. */
export function SortArrowIcon({ className = "h-2.5 w-2.5", direction }: IconProps & { direction: "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 10 10" className={className} aria-hidden>
      <path d={direction === "asc" ? "M5 2 9 8H1Z" : "M5 8 1 2h8Z"} fill="currentColor" />
    </svg>
  );
}
