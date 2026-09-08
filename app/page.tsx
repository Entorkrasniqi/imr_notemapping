import Dashboard from "@/components/dashboard/Dashboard";

// Phase 7: the canvas used to live directly at `/` (one implicit board
// per user, no dashboard). Now `/` is the board list, and each board gets
// its own route at `/board/[boardId]` (see that route's page.tsx).
export default function Home() {
  return <Dashboard />;
}
