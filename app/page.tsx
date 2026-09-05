import Board from "@/components/canvas/Board";

// Phase 1: the canvas lives directly at the root route. Once a dashboard
// and per-board routing exist (Phase 7), this becomes `/board/[boardId]`
// and the root route becomes the dashboard/landing page instead.
export default function Home() {
  return <Board />;
}
