"use client";

import { useEffect, useState } from "react";

/** A parser found the bytes aren't the kind of file they claim to be. */
export class InvalidFileError extends Error {
  constructor(message = "Not a valid file") {
    super(message);
    this.name = "InvalidFileError";
  }
}

export type ParsedFileState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "error"; reason: "missing" | "invalid" | "failed" };

/** What a viewer's parser returns: the value to render, and how to clean up after it. */
export type Parsed<T> = { value: T; dispose?: () => void };

function classify(error: unknown): "missing" | "invalid" | "failed" {
  const { name, message, status } = (error ?? {}) as { name?: string; message?: string; status?: number };
  if (name === "InvalidFileError") return "invalid";
  // The signed-link request says "Object not found" when the bytes are gone;
  // the download itself answers 400/404 for the same thing.
  if (status === 404 || status === 400 || /not found/i.test(message ?? "")) return "missing";
  return "failed";
}

/**
 * Downloads a stored file through a short-lived signed link and runs a
 * viewer's parser over its bytes, with loading and error states and a retry.
 * `parse` must be stable (module-level, or `useCallback`): a new function
 * means a new download. Whatever it returns as `dispose` runs when the file
 * changes or the viewer goes away (e.g. to revoke blob URLs).
 */
export function useParsedFile<T>(
  storagePath: string,
  getUrl: (storagePath: string) => Promise<string>,
  parse: (bytes: ArrayBuffer) => Promise<Parsed<T>>,
) {
  const [state, setState] = useState<ParsedFileState<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let dispose: (() => void) | undefined;

    async function load() {
      setState({ kind: "loading" });
      try {
        const url = await getUrl(storagePath);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
        const bytes = await response.arrayBuffer();
        if (cancelled) return;
        const parsed = await parse(bytes);
        if (cancelled) {
          parsed.dispose?.();
          return;
        }
        dispose = parsed.dispose;
        setState({ kind: "ready", value: parsed.value });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to open a file:", error);
        setState({ kind: "error", reason: classify(error) });
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
      dispose?.();
    };
  }, [storagePath, getUrl, parse, attempt]);

  return { state, retry: () => setAttempt((count) => count + 1) };
}
