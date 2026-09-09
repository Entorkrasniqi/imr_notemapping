"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BoardLimitError,
  createBoard,
  deleteBoard,
  FREE_PLAN_BOARD_LIMIT,
  getUserPlan,
  listBoards,
  renameBoard,
  type BoardSummary,
} from "@/lib/supabase/boards";
import ThemeToggle from "@/components/theme/ThemeToggle";

type LoadStatus = "loading" | "ready" | "error";

/** "3 minutes ago", "2 days ago", etc. — good enough for a dashboard card. */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsInUnit] of units) {
    if (diffSeconds >= secondsInUnit) {
      return rtf.format(-Math.floor(diffSeconds / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "minute");
}

// A small, fixed set of complete class-name strings — Tailwind's compiler
// scans source text statically, so building these from interpolated
// pieces (e.g. `from-${hue}-100`) would silently produce no styles at
// all. Picking one per board by hashing its id gives each card a
// distinct, tasteful cover without any per-board configuration or
// uploaded image.
const COVER_PALETTE = [
  "from-rose-100 via-rose-50 to-white",
  "from-amber-100 via-amber-50 to-white",
  "from-emerald-100 via-emerald-50 to-white",
  "from-sky-100 via-sky-50 to-white",
  "from-violet-100 via-violet-50 to-white",
  "from-teal-100 via-teal-50 to-white",
] as const;

function coverClassFor(boardId: string): string {
  let hash = 0;
  for (let i = 0; i < boardId.length; i++) {
    hash = (hash * 31 + boardId.charCodeAt(i)) >>> 0;
  }
  return COVER_PALETTE[hash % COVER_PALETTE.length];
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth={1.3} />
      <path d="M8 4.8V8l2.2 1.3" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0" aria-hidden>
      <rect x="3" y="2.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth={1.3} />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.5 12.1l-2.8.7.7-2.8Z"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M3.5 4.5h9M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5v8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-8"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The abstract two-node mark used as NoteMap's logo throughout the app. */
function LogoMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-zinc-800 to-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <circle cx="4.5" cy="4.5" r="2" fill="white" fillOpacity={0.95} />
        <circle cx="11.5" cy="11.5" r="2" fill="white" fillOpacity={0.95} />
        <path d="M6 6l4 4" stroke="white" strokeOpacity={0.6} strokeWidth={1.2} />
      </svg>
    </div>
  );
}

function BoardCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-zinc-200/70 bg-white dark:border-white/10 dark:bg-white/5 blueprint:border-white/20 blueprint:bg-white/5">
      <div className="h-20 bg-zinc-100 dark:bg-white/10 blueprint:bg-white/10" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3.5 w-2/3 rounded-full bg-zinc-100 dark:bg-white/10 blueprint:bg-white/10" />
        <div className="h-2.5 w-1/2 rounded-full bg-zinc-100 dark:bg-white/10 blueprint:bg-white/10" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [plan, setPlan] = useState<string>("free");
  const [isCreating, setIsCreating] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  // Bumped by the "Try again" button to re-run the load effect below —
  // same retry mechanism as useSupabaseBoardSync's own load effect.
  const [retryToken, setRetryToken] = useState(0);

  // Double-click-to-rename, same interaction pattern as the canvas notes.
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        const [result, userPlan] = await Promise.all([
          listBoards(supabase),
          getUserPlan(supabase),
        ]);
        if (cancelled) return;
        setBoards(result);
        setPlan(userPlan);
        setStatus("ready");
      } catch (error) {
        console.error("Failed to load boards:", error);
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, retryToken]);

  const retryLoad = useCallback(() => setRetryToken((token) => token + 1), []);

  const handleCreateBoard = useCallback(async () => {
    setLimitMessage(null);
    setIsCreating(true);
    try {
      const board = await createBoard(supabase, "Untitled board");
      // Straight into the new board — creating one and opening it are the
      // same gesture from the user's point of view.
      router.push(`/board/${board.id}`);
    } catch (error) {
      setIsCreating(false);
      if (error instanceof BoardLimitError) {
        setLimitMessage(`You've reached the free plan limit of ${FREE_PLAN_BOARD_LIMIT} boards.`);
        return;
      }
      console.error("Failed to create board:", error);
      setLimitMessage("Something went wrong creating that board. Try again.");
    }
  }, [supabase, router]);

  const handleOpenBoard = useCallback(
    (boardId: string) => {
      router.push(`/board/${boardId}`);
    },
    [router],
  );

  const handleStartRename = useCallback((board: BoardSummary) => {
    setEditingBoardId(board.id);
    setEditingValue(board.name);
  }, []);

  const handleCommitRename = useCallback(async () => {
    if (!editingBoardId) return;
    const boardId = editingBoardId;
    const name = editingValue.trim();
    setEditingBoardId(null);
    if (!name) return;

    const previous = boards;
    setBoards((current) =>
      current.map((board) => (board.id === boardId ? { ...board, name } : board)),
    );
    try {
      await renameBoard(supabase, boardId, name);
    } catch (error) {
      console.error("Failed to rename board:", error);
      setBoards(previous);
    }
  }, [editingBoardId, editingValue, boards, supabase]);

  const handleDeleteBoard = useCallback(
    async (board: BoardSummary) => {
      const confirmed = window.confirm(`Delete "${board.name}"? This can't be undone.`);
      if (!confirmed) return;

      const previous = boards;
      setBoards((current) => current.filter((b) => b.id !== board.id));
      setLimitMessage(null);
      try {
        await deleteBoard(supabase, board.id);
      } catch (error) {
        console.error("Failed to delete board:", error);
        setBoards(previous);
      }
    },
    [boards, supabase],
  );

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  // Mirrors the trigger's own condition (`enforce_free_plan_board_limit`
  // only counts boards for `plan = 'free'`) — a pro account never hits
  // this, matching the database exactly rather than assuming everyone
  // is on the free plan.
  const isPro = plan !== "free";
  const atLimit = !isPro && boards.length >= FREE_PLAN_BOARD_LIMIT;
  const usageFraction = Math.min(boards.length / FREE_PLAN_BOARD_LIMIT, 1);

  return (
    <div className="blueprint-grid min-h-screen bg-[radial-gradient(circle_at_top,_#fafafa,_#f4f4f5_60%)] dark:bg-[radial-gradient(circle_at_top,_#18181b,_#09090b_60%)] blueprint:bg-background">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-black/40 blueprint:border-white/15 blueprint:bg-[#0f3057]/70">
        {/* `flex-wrap` — confirmed necessary by testing at 380px width,
            where the theme toggle, plan badge, and "Log out" crowded
            into an almost-unreadable single row otherwise. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white blueprint:text-white">
              NoteMap
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ThemeToggle />
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${
                isPro
                  ? "bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:from-amber-500/20 dark:to-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30 blueprint:from-amber-400/20 blueprint:to-amber-400/10 blueprint:text-amber-200 blueprint:ring-amber-300/30"
                  : "bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200 dark:bg-white/5 dark:text-white/50 dark:ring-white/10 blueprint:bg-white/10 blueprint:text-white/60 blueprint:ring-white/20"
              }`}
            >
              {isPro ? "Pro" : "Free"}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 shadow-sm transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:border-white/20 dark:hover:text-white blueprint:border-white/20 blueprint:bg-white/5 blueprint:text-white/70 blueprint:hover:border-white/40 blueprint:hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-8">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 dark:text-white blueprint:font-mono blueprint:text-white">
              Your boards
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-white/50 blueprint:text-white/70">
              {isPro
                ? "Unlimited boards on the Pro plan."
                : `${boards.length} of ${FREE_PLAN_BOARD_LIMIT} boards used on the free plan.`}
            </p>
            {!isPro && (
              <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10 blueprint:bg-white/15">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    atLimit
                      ? "bg-amber-500"
                      : "bg-zinc-800 dark:bg-white blueprint:bg-white"
                  }`}
                  style={{ width: `${usageFraction * 100}%` }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCreateBoard}
            disabled={isCreating || atLimit || status !== "ready"}
            title={atLimit ? `Free plan is limited to ${FREE_PLAN_BOARD_LIMIT} boards` : undefined}
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-gradient-to-b from-zinc-800 to-zinc-950 px-4 py-2.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_20px_-8px_rgba(0,0,0,0.35)] transition-all duration-150 hover:shadow-[0_1px_2px_rgba(0,0,0,0.25),0_10px_24px_-6px_rgba(0,0,0,0.4)] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100 dark:from-white dark:to-zinc-200 dark:text-zinc-900 blueprint:border blueprint:border-white/40 blueprint:from-transparent blueprint:to-transparent blueprint:text-white blueprint:shadow-none blueprint:hover:bg-white/10 blueprint:hover:brightness-100"
          >
            <PlusIcon />
            {isCreating ? "Creating…" : "Create board"}
          </button>
        </div>

        {limitMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 blueprint:border-white/30 blueprint:bg-white/10 blueprint:text-white">
            {limitMessage}
          </div>
        )}
        {atLimit && !limitMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 blueprint:border-white/30 blueprint:bg-white/10 blueprint:text-white">
            You&apos;ve reached the free plan limit of {FREE_PLAN_BOARD_LIMIT} boards. Delete one,
            or upgrade to Pro, to create another.
          </div>
        )}

        {status === "loading" && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <BoardCardSkeleton />
              </li>
            ))}
          </ul>
        )}

        {status === "error" && (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 blueprint:border-white/20 blueprint:bg-white/5">
            <p className="text-sm text-zinc-600 dark:text-white/60 blueprint:text-white/80">
              Couldn&apos;t reach the database.
            </p>
            <button
              type="button"
              onClick={retryLoad}
              className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:hover:bg-white/10"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && boards.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center dark:border-white/15 dark:bg-white/5 blueprint:border-white/30 blueprint:bg-white/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-white/10 dark:text-white/50 blueprint:bg-white/10 blueprint:text-white/70">
              <PlusIcon />
            </div>
            <p className="text-sm font-medium text-zinc-700 dark:text-white/80 blueprint:text-white">
              No boards yet
            </p>
            <p className="max-w-xs text-sm text-zinc-500 dark:text-white/50 blueprint:text-white/70">
              Create your first board to start mapping out notes and ideas on an infinite canvas.
            </p>
          </div>
        )}

        {status === "ready" && boards.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li
                key={board.id}
                data-board-id={board.id}
                className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_32px_-16px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-zinc-900 dark:shadow-none dark:hover:border-white/20 dark:hover:shadow-[0_16px_32px_-16px_rgba(0,0,0,0.6)] blueprint:border-white/20 blueprint:bg-white/[0.06] blueprint:shadow-none blueprint:hover:border-white/40 blueprint:hover:shadow-[0_16px_32px_-16px_rgba(0,0,0,0.4)]"
              >
                {/* A `div[role="button"]`, not a real `<button>` — on
                    purpose, and only after a real bug proved why. A
                    native `<button>` gives free Enter/Space keyboard
                    activation, but that's specifically tied to whichever
                    element the browser considers "the button" for
                    activation purposes, and having the rename `<input>`
                    nested inside it (invalid HTML content-model-wise, but
                    something browsers still render) meant typing a plain
                    space while renaming — i.e. any board name with a
                    space in it — was silently activating the *button's*
                    keyup-on-Space handling and navigating away mid-edit,
                    same as Enter did. `role="button"` gives assistive
                    tech the right semantics without any of that native
                    content-model baggage, at the cost of having to wire
                    up Enter/Space ourselves below. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenBoard(board.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenBoard(board.id);
                    }
                  }}
                  className="flex w-full cursor-pointer flex-col items-start text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-white blueprint:focus-visible:outline-white"
                >
                  {/* Two stacked layers, not one element with two `bg-*`
                      utilities — both `bg-gradient-to-br` and an
                      arbitrary `bg-[radial-gradient(...)]` compile to the
                      same `background-image` property, so combining them
                      on one element makes the second silently replace the
                      first instead of layering over it. */}
                  <div className={`relative h-20 w-full overflow-hidden bg-gradient-to-br ${coverClassFor(board.id)}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)] bg-[length:14px_14px]" />
                  </div>
                  <div className="flex w-full flex-col gap-1.5 p-4">
                    {editingBoardId === board.id ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setEditingValue(event.target.value)}
                        onBlur={handleCommitRename}
                        onKeyDown={(event) => {
                          // Stops every keystroke here from bubbling up
                          // to the card's own `onKeyDown` (which treats
                          // Enter/Space as "open this board" — see the
                          // comment on that wrapper for the real bug that
                          // made this necessary: a space bar keystroke
                          // typed into a *nested* interactive element
                          // used to reach a native `<button>` ancestor's
                          // own activation handling before this was
                          // switched to a plain `div[role="button"]`
                          // with keydown handling we fully control).
                          event.stopPropagation();
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleCommitRename();
                          }
                          if (event.key === "Escape") {
                            setEditingBoardId(null);
                          }
                        }}
                        className="w-full rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-[15px] font-medium text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-white/20 dark:bg-zinc-800 dark:text-white dark:focus:border-white/50 dark:focus:ring-white/10 blueprint:border-white/30 blueprint:bg-[#0f3057] blueprint:text-white blueprint:focus:border-white blueprint:focus:ring-white/20"
                      />
                    ) : (
                      // Both the single clicks that make up a double-click,
                      // and the double-click itself, must stop propagation
                      // here — the card's own onClick sits on its parent and
                      // would otherwise navigate to the board on the first
                      // of the two clicks, before the second click ever
                      // produces a dblclick event to rename it.
                      <span
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          handleStartRename(board);
                        }}
                        title="Double-click to rename"
                        className="truncate text-[15px] font-medium tracking-tight text-zinc-900 dark:text-white blueprint:text-white"
                      >
                        {board.name}
                      </span>
                    )}
                    <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-white/40 blueprint:text-white/60">
                      <span className="flex items-center gap-1">
                        <ClockIcon />
                        {formatRelativeTime(board.updatedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <NotesIcon />
                        {board.noteCount} {board.noteCount === 1 ? "note" : "notes"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Both action buttons stay hidden until hovered *or*
                    keyboard-focused — `group-focus-within` (not just
                    `group-hover`) on the wrapper below means tabbing to
                    either button makes the whole pair visible, not just
                    the one that happens to be focused. Without that, a
                    keyboard user tabbing here would land on a button
                    they can't see, which defeats the point of it being
                    reachable at all. This pair is also what makes
                    renaming possible without a mouse in the first place:
                    the double-click-to-rename on the name itself (below)
                    has no keyboard equivalent. */}
                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleStartRename(board);
                    }}
                    title="Rename board"
                    aria-label={`Rename "${board.name}"`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-zinc-400 shadow-sm backdrop-blur transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:bg-black/50 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white blueprint:bg-black/30 blueprint:text-white/60 blueprint:hover:bg-white/10 blueprint:hover:text-white"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBoard(board)}
                    title="Delete board"
                    aria-label={`Delete "${board.name}"`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-zinc-400 shadow-sm backdrop-blur transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-black/50 dark:text-white/50 dark:hover:bg-red-500/20 dark:hover:text-red-400 blueprint:bg-black/30 blueprint:text-white/60 blueprint:hover:bg-red-500/20 blueprint:hover:text-red-300"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
