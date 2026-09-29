# ScriptumOS for Mac

ScriptumOS is the native macOS version of the NoteMap web app (SwiftUI +
AppKit), built as a **universal binary**, so the same app runs natively on
Apple Silicon and Intel Macs. It runs on macOS 13 Ventura or later.

The app ships as `ScriptumOS.app` (bundle id `com.scriptumos.ScriptumOS`).
The Xcode project, target, scheme, and source folders are still named
`NoteMap`.

It talks to the **same Supabase project** as the web app: same tables, same
Row Level Security, same accounts. No database changes are needed, and
boards and notes edited in one app show up in the other.

## Setup

1. Copy `Config/Supabase.example.xcconfig` to `Config/Supabase.xcconfig` and
   fill in the two public values from the web app's `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). The file is
   gitignored. Only the anon key goes here, never the service-role key or any
   Stripe secret.
2. Open `NoteMap.xcodeproj` in Xcode 16 or later, pick the **NoteMap** scheme
   and **My Mac**, and press Run.

Without step 1 the app still builds, and shows a "not configured" screen.

To install it in Applications with a shortcut on your Desktop (run again
after code changes to update it):

```sh
sh macos/scripts/install.sh
```

## Building for Intel and Apple Silicon

Release builds are universal (`arm64` + `x86_64`); Debug builds only compile
for the Mac you're on. To produce a universal app:

```sh
xcodebuild -project NoteMap.xcodeproj -scheme NoteMap -configuration Release \
  -derivedDataPath build archive -archivePath build/ScriptumOS.xcarchive
lipo -archs build/ScriptumOS.xcarchive/Products/Applications/ScriptumOS.app/Contents/MacOS/ScriptumOS
# → x86_64 arm64
```

Or use **Product ▸ Archive** in Xcode.

### Giving it to other people

The project signs with "Sign to Run Locally", which is fine on your own Mac.
Other Macs will block an app that isn't signed with a Developer ID and
notarized. Once you have an Apple Developer account:

1. In the NoteMap target's **Signing & Capabilities**, choose your team.
2. Archive, then use **Distribute App ▸ Direct Distribution** in the Organizer.
   This signs with Developer ID and notarizes in one step.

Until then, testers can open the app with right-click ▸ Open (on macOS 15 and
later: System Settings ▸ Privacy & Security ▸ Open Anyway).

## How it maps to the web app

| Web | Mac |
| --- | --- |
| `lib/supabase/*.ts` | `NoteMap/Supabase/` — Auth and PostgREST over plain HTTP, no dependencies |
| `lib/supabase/board-mapping.ts`, `lib/editor/content.ts` | `NoteMap/Model/` |
| `components/dashboard/Dashboard.tsx` | `NoteMap/Dashboard/` |
| `components/canvas/Board.tsx`, `NoteNode.tsx`, `DeletableEdge.tsx`, `hooks/` | `NoteMap/Board/` |
| `components/canvas/NoteEditorModal.tsx`, `components/editor/` | `NoteMap/Editor/` |
| `lib/theme/`, `components/theme/` | `NoteMap/Theme/` |

Two pieces are what keep the two apps compatible:

- **`Editor/TiptapConverter.swift`** converts a note's Tiptap JSON to the text
  the native editor edits, and back. Its output has the same shape as
  Tiptap's own `getJSON()` for the extensions in `lib/editor/extensions.ts`.
  Anything it can't edit (tables, mentions, …) passes through untouched.
- **`Board/EdgeGeometry.swift`** is a port of React Flow's handle positions
  and smooth-step routing. Edges store React Flow handle ids (`right-0.5`,
  `top-left`, …), so arrows attach to the same points in both apps.

## Differences from the web app

- **Billing opens the browser.** The Stripe Checkout and Portal routes
  authenticate with the web session cookie, so "Upgrade to Pro" and "Manage
  billing" open `NOTEMAP_WEB_URL`. The app re-checks the plan when you come
  back to it. Doing checkout natively would need those two routes to also
  accept a bearer token, which is a small server change.
- **Trackpad**: two-finger scrolling pans and pinching zooms. On the web,
  scrolling zooms. A mouse wheel still zooms, and ⌘-scroll always does.
- **Undo on the canvas** restores positions, sizes, and which notes exist, but
  keeps any text you've typed since. On the web, undoing a move also reverts
  later typing in that note.
- **Saving** writes only the rows that changed, instead of the whole board,
  and pending changes are flushed when you leave a board, log out, or quit.
- **Notes whose first block is an image** (an image dropped on an empty tile)
  keep the image when you edit them. The web editor treats that image as the
  title and drops it on the first edit.
- **Paste from other apps** keeps bold, italic, underline, strikethrough,
  alignment, and the toolbar's own colors, and drops other fonts and sizes.
  Copy and paste between notes keeps everything.

## Tests

```sh
xcodebuild test -project NoteMap.xcodeproj -scheme NoteMap -destination 'platform=macOS'
```

The Tiptap fixtures in `NoteMapTests/` are in the exact shape the web app's
editor produces, and the edge-routing expectations were captured from React
Flow's own `getSmoothStepPath`. If you change a fixture or upgrade Tiptap,
recheck the fixtures against the real schema from the repository root:

```sh
node --experimental-strip-types --no-warnings macos/scripts/check-tiptap-fixtures.mjs
```
