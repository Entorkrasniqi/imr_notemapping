"use client";

import { SpinnerIcon } from "./icons";
import type { ParsedFileState } from "./useParsedFile";

type ViewerMessageProps = {
  state: Exclude<ParsedFileState<unknown>, { kind: "ready" }>;
  fileName: string;
  /** What the file should have been, with its article: "a Word document", "an image"… */
  what: string;
  onRetry: () => void;
};

/** The loading and error states every non-PDF viewer shows in place of its content. */
export default function ViewerMessage({ state, fileName, what, onRetry }: ViewerMessageProps) {
  if (state.kind === "loading") {
    return (
      <p className="flex items-center justify-center gap-2 px-4 py-16 text-[13px] text-(--zt-dim)">
        <SpinnerIcon className="h-4 w-4" />
        Opening {fileName}…
      </p>
    );
  }
  const text = {
    missing: "This file is missing from storage. Remove it from the sidebar and add it again.",
    invalid: `This file couldn’t be read as ${what}.`,
    failed: "Couldn’t load the file. Check your connection and try again.",
  }[state.reason];
  return (
    <div role="alert" className="mx-auto flex max-w-xs flex-col items-center gap-3 px-4 py-16 text-center text-[13px] text-(--zt-dim)">
      <p>{text}</p>
      {state.reason === "failed" && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-(--zt-field-border) bg-(--zt-field) px-3 py-1 text-(--zt-text) hover:bg-(--zt-hover)"
        >
          Try again
        </button>
      )}
    </div>
  );
}
