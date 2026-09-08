import Board from "@/components/canvas/Board";

// Phase 7: the canvas moved here from `/` once the dashboard took over
// the root route. `params` is a Promise in this Next.js version (see
// AGENTS.md) — `PageProps<'/board/[boardId]'>` is the generated helper
// type for this exact route, same pattern as `app/layout.tsx`'s
// `LayoutProps<'/'>`.
export default async function BoardPage(props: PageProps<"/board/[boardId]">) {
  const { boardId } = await props.params;
  return <Board boardId={boardId} />;
}
