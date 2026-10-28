import type { StoredBoardFile } from "@/lib/supabase/board-files";

/** What every viewer is given. The name, close button and width belong to the tab and pane around it. */
export type ViewerProps = {
  file: StoredBoardFile;
  /** Resolves a short-lived link to the file's bytes (the bucket is private). */
  getUrl: (storagePath: string) => Promise<string>;
};
