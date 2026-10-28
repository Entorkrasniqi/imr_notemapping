// Icons for the app chrome (dashboard, board toolbar, sign-in): the same thin
// 16px outline style as the files panel's, in `currentColor`, so there is one
// icon language across the product. The shared ones are re-exported.
export { CloseIcon, ChevronIcon, PencilIcon, PlusIcon, SearchIcon, SortArrowIcon, SpinnerIcon, TrashIcon } from "@/components/files/icons";

type IconProps = { className?: string };

const base = { viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
const stroke = { stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Four corners — "fit everything in view". */
export function FitViewIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" {...stroke} />
    </svg>
  );
}

/** A door with an arrow leaving it. */
export function LogOutIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 2.5h-2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2M10 5l3 3-3 3M13 8H6.5" {...stroke} />
    </svg>
  );
}

/** A page with a plus — "new note". */
export function NewNoteIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8.5 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7.5" {...stroke} />
      <path d="M12 2v4M10 4h4" {...stroke} />
    </svg>
  );
}

/** A board: a small tree of boxes — the dashboard's row icon. */
export function BoardIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="2.5" width="5" height="3.5" rx="0.8" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <rect x="9" y="10" width="5" height="3.5" rx="0.8" fill="currentColor" fillOpacity={0.13} {...stroke} />
      <path d="M4.5 6v2.5a1 1 0 0 0 1 1H9" {...stroke} />
    </svg>
  );
}

/** A folder-style "open". */
export function OpenIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 4.5a1 1 0 0 1 1-1h3l1.3 1.5H13a1 1 0 0 1 1 1V11.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" fill="currentColor" fillOpacity={0.13} {...stroke} />
    </svg>
  );
}
