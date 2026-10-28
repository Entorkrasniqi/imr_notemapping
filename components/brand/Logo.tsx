/**
 * NoteMap's mark: two linked nodes on a flat accent-blue tile — the same
 * idea as before, with the gradient, glow and inset highlight taken off so
 * it sits in the interface like a native app icon rather than decoration.
 */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
      <rect width="20" height="20" rx="4.5" fill="var(--zt-accent)" />
      <path d="M6.6 6.6 13.4 13.4" stroke="#fff" strokeOpacity={0.75} strokeWidth="1.4" />
      <circle cx="6" cy="6" r="2.4" fill="#fff" />
      <circle cx="14" cy="14" r="2.4" fill="#fff" />
    </svg>
  );
}

/** The mark and the name together, as in the window title of a desktop app. */
export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-[14px] font-semibold tracking-[-0.005em]">NoteMap</span>
    </span>
  );
}
