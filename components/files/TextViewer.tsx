"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import ReaderShell, { readerToolButton } from "./ReaderShell";
import { useParsedFile, type Parsed } from "./useParsedFile";
import ViewerMessage from "./ViewerMessage";
import type { ViewerProps } from "./viewer-types";

// The Markdown renderer is only fetched when a Markdown file is opened.
const MarkdownBody = dynamic(() => import("./MarkdownBody"), {
  ssr: false,
  loading: () => <p className="text-sm opacity-60">Loading…</p>,
});

/** A very long file is shown up to here; the rest would just make the page slow. */
const MAX_CHARS = 1_000_000;

type TextContent = { text: string; truncated: boolean };

async function parseText(bytes: ArrayBuffer): Promise<Parsed<TextContent>> {
  const text = new TextDecoder("utf-8").decode(bytes);
  const truncated = text.length > MAX_CHARS;
  return { value: { text: truncated ? text.slice(0, MAX_CHARS) : text, truncated } };
}

/** Plain text, or Markdown shown rendered with a switch to its source. */
export default function TextViewer({ file, getUrl }: ViewerProps) {
  const markdown = file.format === "markdown";
  const { state, retry } = useParsedFile(file.storagePath, getUrl, parseText);
  const [view, setView] = useState<"rendered" | "source">("rendered");
  const showRendered = markdown && view === "rendered";

  return (
    <ReaderShell
      file={file}
      toolbar={
        markdown ? (
          <div role="group" aria-label="Show" className="flex items-center gap-1">
            {(["rendered", "source"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={`${readerToolButton} px-2 capitalize aria-pressed:bg-(--zt-hover)`}
              >
                {option}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div tabIndex={0} aria-label="Text" className="zt-scroll min-h-0 flex-1 overflow-auto bg-(--zt-list) px-6 py-5 text-(--zt-text) outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--zt-select)">
        {state.kind !== "ready" ? (
          <ViewerMessage state={state} fileName={file.name} what="a text file" onRetry={retry} />
        ) : (
          <>
            {showRendered ? (
              <article className="doc-prose mx-auto max-w-[70ch]">
                <MarkdownBody text={state.value.text} />
              </article>
            ) : (
              <pre className="mx-auto max-w-[90ch] whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">{state.value.text}</pre>
            )}
            {state.value.truncated && (
              <p className="zt-banner mx-auto mt-4 max-w-[70ch] text-[12px]">
                This file is long — showing the first {MAX_CHARS.toLocaleString()} characters.
              </p>
            )}
          </>
        )}
      </div>
    </ReaderShell>
  );
}
