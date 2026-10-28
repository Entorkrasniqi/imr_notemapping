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
import { LogoMark } from "@/components/brand/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { BoardIcon, PencilIcon, PlusIcon, SearchIcon, SortArrowIcon, TrashIcon } from "@/components/ui/icons";

type LoadStatus = "loading" | "ready" | "error";

/** "3 minutes ago", "2 days ago", etc. — good enough for a list column. */
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

type SortKey = "name" | "notes" | "updated";

/** A sortable column heading, with Zotero's small solid arrow on the sorted one. */
function ColumnHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      className={`flex items-center gap-1 text-left outline-offset-[-2px] hover:bg-(--zt-hover) focus-visible:outline-2 focus-visible:outline-(--zt-accent) ${className}`}
    >
      <span className={active ? "font-semibold text-(--zt-text)" : ""}>{label}</span>
      {active && <SortArrowIcon direction={sort.dir} />}
    </button>
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

  // Renaming happens in place in the list (pencil button, then Enter).
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "updated", dir: "desc" });

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

  // Landing back here right after Checkout (`success_url` in the checkout
  // route) — the redirect can beat Stripe's `checkout.session.completed`
  // webhook to us, so `plan` may still read "free" for a second. Poll
  // briefly rather than tell a paying user their upgrade didn't work.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    window.history.replaceState({}, "", window.location.pathname);

    let cancelled = false;
    let attempts = 0;
    async function poll() {
      if (cancelled) return;
      attempts += 1;
      const userPlan = await getUserPlan(supabase).catch(() => null);
      if (userPlan === "pro") {
        if (!cancelled) setPlan(userPlan);
        return;
      }
      if (attempts < 5) setTimeout(poll, 1000);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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

  const visibleBoards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle ? boards.filter((board) => board.name.toLowerCase().includes(needle)) : boards;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...matching].sort((a, b) => {
      if (sort.key === "name") return sign * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      if (sort.key === "notes") return sign * (a.noteCount - b.noteCount);
      return sign * (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0);
    });
  }, [boards, query, sort]);
  const toggleSort = (key: SortKey) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "updated" ? "desc" : "asc" }));

  return (
    <div className="zt flex h-screen min-h-0 flex-col bg-(--zt-window)">
      {/* The title bar: the product on the left, account and appearance on the
          right — one row, like the top of a desktop app's window. */}
      <header className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-(--zt-border) bg-(--zt-chrome-2) px-3 py-1">
        <div className="flex items-center gap-2">
          <LogoMark size={20} />
          <span className="text-[14px] font-semibold">NoteMap</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          <span className="hidden text-[12px] text-(--zt-dim) sm:inline">{isPro ? "Pro plan" : "Free plan"}</span>
          {isPro ? (
            <form action="/api/stripe/portal" method="POST">
              <button type="submit" className="zt-btn">
                Manage billing
              </button>
            </form>
          ) : (
            <form action="/api/stripe/checkout" method="POST">
              <button type="submit" className="zt-btn zt-btn-primary">
                Upgrade to Pro
              </button>
            </form>
          )}
          <button type="button" onClick={handleLogout} className="zt-btn">
            Log out
          </button>
        </div>
      </header>

      <div className="zt-toolbar shrink-0 gap-1.5">
        <button
          type="button"
          onClick={handleCreateBoard}
          disabled={isCreating || atLimit || status !== "ready"}
          title={atLimit ? `Free plan is limited to ${FREE_PLAN_BOARD_LIMIT} boards` : undefined}
          className="zt-btn"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {isCreating ? "Creating…" : "Create board"}
        </button>
        <span className="flex-1" />
        <div className="relative w-full max-w-56">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--zt-dim)" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setQuery("")}
            placeholder="Search boards"
            aria-label="Search boards"
            autoComplete="off"
            className="zt-field pl-7 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </div>

      {(limitMessage || atLimit) && (
        <div className="shrink-0 border-b border-(--zt-border) bg-(--zt-window) px-3 py-2">
          <div className="zt-banner flex-wrap justify-between">
            <span>
              {limitMessage ??
                `You've reached the free plan limit of ${FREE_PLAN_BOARD_LIMIT} boards. Delete one, or upgrade to Pro, to create another.`}
            </span>
            {!limitMessage && (
              <form action="/api/stripe/checkout" method="POST">
                <button type="submit" className="zt-btn zt-btn-primary">
                  Upgrade to Pro
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col bg-(--zt-list)">
        {status === "ready" && boards.length > 0 && (
          <div className="flex h-6 shrink-0 items-stretch border-b border-(--zt-border) bg-(--zt-chrome) text-[12px] text-(--zt-dim)">
            <ColumnHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} className="flex-1 pl-9" />
            <ColumnHeader label="Notes" sortKey="notes" sort={sort} onSort={toggleSort} className="hidden w-20 justify-end border-l border-(--zt-border) pr-3 sm:flex" />
            <ColumnHeader label="Last updated" sortKey="updated" sort={sort} onSort={toggleSort} className="w-36 justify-end border-l border-(--zt-border) pr-3" />
            <span className="w-16 shrink-0" aria-hidden />
          </div>
        )}

        <div className="zt-scroll min-h-0 flex-1 overflow-y-auto">
          {status === "loading" && (
            <ul aria-label="Loading boards" className="animate-pulse">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex h-7 items-center gap-2 px-3 odd:bg-(--zt-list) even:bg-(--zt-stripe)">
                  <span className="h-3.5 w-3.5 rounded-sm bg-(--zt-hover)" />
                  <span className="h-2.5 w-40 rounded-sm bg-(--zt-hover)" />
                </li>
              ))}
            </ul>
          )}

          {status === "error" && (
            <div className="flex flex-col items-start gap-2 px-4 py-4 text-(--zt-dim)">
              <p>Couldn&apos;t reach the database.</p>
              <button type="button" onClick={retryLoad} className="zt-btn">
                Try again
              </button>
            </div>
          )}

          {status === "ready" && boards.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <BoardIcon className="h-8 w-8 text-(--zt-dim) opacity-60" />
              <p className="text-[14px] font-semibold">No boards yet</p>
              <p className="max-w-xs text-(--zt-dim)">
                Create your first board to start mapping out notes and ideas on an infinite canvas.
              </p>
              <button type="button" onClick={handleCreateBoard} disabled={isCreating || atLimit} className="zt-btn zt-btn-primary mt-1">
                <PlusIcon className="h-3.5 w-3.5" />
                Create board
              </button>
            </div>
          )}

          {status === "ready" && boards.length > 0 && visibleBoards.length === 0 && (
            <p className="px-4 py-4 text-center text-(--zt-dim)">No boards match “{query.trim()}”.</p>
          )}

          {status === "ready" && visibleBoards.length > 0 && (
            <ul aria-label="Boards">
              {visibleBoards.map((board) => (
                <li
                  key={board.id}
                  data-board-id={board.id}
                  className="group relative odd:bg-(--zt-list) even:bg-(--zt-stripe) hover:bg-(--zt-hover)"
                >
                  {/* A `div[role="button"]`, not a real `<button>` — on
                      purpose, and only after a real bug proved why. A native
                      `<button>` gives free Enter/Space activation, but with
                      the rename `<input>` nested inside it (invalid HTML,
                      though browsers still render it) typing a space while
                      renaming — any board name with a space in it — was
                      activating the *button's* keyup-on-Space handling and
                      navigating away mid-edit, same as Enter did.
                      `role="button"` gives assistive tech the right
                      semantics without that native baggage, at the cost of
                      wiring up Enter/Space ourselves below. */}
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
                    // Keyboard focus is the blue selection bar, as in Zotero.
                    className="flex h-7 w-full cursor-default items-center outline-none focus-visible:bg-(--zt-select) focus-visible:text-(--zt-select-text)"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 pl-3 pr-2">
                      <BoardIcon className="h-4 w-4 shrink-0 text-(--zt-accent) group-has-[:focus-visible]:text-inherit" />
                      {editingBoardId === board.id ? (
                        <input
                          autoFocus
                          aria-label={`Rename "${board.name}"`}
                          value={editingValue}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setEditingValue(event.target.value)}
                          onBlur={handleCommitRename}
                          onKeyDown={(event) => {
                            // Stops every keystroke here bubbling up to the
                            // row's own `onKeyDown` (Enter/Space = "open this
                            // board") — see the comment on the wrapper.
                            event.stopPropagation();
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleCommitRename();
                            }
                            if (event.key === "Escape") {
                              setEditingBoardId(null);
                            }
                          }}
                          className="zt-field h-5 min-w-0 flex-1 text-[13px] text-(--zt-text)"
                        />
                      ) : (
                        <span className="truncate">{board.name}</span>
                      )}
                    </span>
                    <span className="hidden w-20 shrink-0 pr-3 text-right tabular-nums text-(--zt-dim) group-has-[:focus-visible]:text-inherit sm:block">
                      {board.noteCount}
                    </span>
                    <span className="w-36 shrink-0 pr-3 text-right text-(--zt-dim) group-has-[:focus-visible]:text-inherit">
                      {formatRelativeTime(board.updatedAt)}
                    </span>
                    <span className="w-16 shrink-0" aria-hidden />
                  </div>

                  {/* Rename and delete stay out of sight (but present, for a
                      screen reader) until the row is hovered or keyboard-focused,
                      and are click-through until then so an unseen button can't
                      catch a stray click. This pair is also what makes renaming
                      possible without a mouse. */}
                  <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5 opacity-0 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStartRename(board);
                      }}
                      title="Rename board"
                      aria-label={`Rename "${board.name}"`}
                      className="zt-tbtn h-5 min-w-5 px-0"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBoard(board)}
                      title="Delete board"
                      aria-label={`Delete "${board.name}"`}
                      className="zt-tbtn h-5 min-w-5 px-0 hover:text-(--zt-danger)"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <footer className="flex h-6 shrink-0 items-center gap-1 border-t border-(--zt-border) bg-(--zt-chrome) px-3 text-[12px] text-(--zt-dim)">
        {status === "ready" && (
          <span className={atLimit ? "font-medium text-(--zt-warn-text)" : ""}>
            {isPro
              ? `${boards.length} ${boards.length === 1 ? "board" : "boards"} · Unlimited boards on the Pro plan`
              : `${boards.length} of ${FREE_PLAN_BOARD_LIMIT} boards used on the free plan`}
          </span>
        )}
      </footer>
    </div>
  );
}
