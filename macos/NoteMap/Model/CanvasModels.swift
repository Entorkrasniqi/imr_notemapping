import Foundation
import CoreGraphics

/// A note on the canvas — the native counterpart of `NoteNode` in the web
/// app's `types/canvas.ts`.
///
/// `content` is the Tiptap document exactly as the web editor stores it
/// (`nil` meaning "nothing typed yet", `{}` in the database — see
/// `BoardMapping`). `contentRevision` is local-only bookkeeping: bumped on
/// every content change so the canvas can cache a note's rendered tile
/// without hashing a document that may hold megabytes of base64 image data.
struct NoteNode: Identifiable {
    let id: String
    var position: CGPoint
    var width: CGFloat
    var height: CGFloat
    var content: JSONValue?
    /// Unused, kept only so existing rows round-trip unchanged — see the
    /// comment on `expandedHeight` in the web app's `types/canvas.ts`.
    var expandedHeight: Double?
    var contentRevision = 0

    var frame: CGRect {
        CGRect(x: position.x, y: position.y, width: width, height: height)
    }
}

/// A connection between two notes. `sourceHandle`/`targetHandle` are React
/// Flow handle ids (`"top-left"`, `"right-0.5"`, …) — see `NoteHandles`.
struct BoardEdge: Identifiable, Equatable {
    let id: String
    var source: String
    var target: String
    var sourceHandle: String?
    var targetHandle: String?
}

/// Board sizing constants shared with the web canvas (`Board.tsx`,
/// `NoteNode.tsx`), so a note created or resized on either client looks the
/// same on the other.
enum NoteMetrics {
    /// Size of a freshly created note (`createNote` in Board.tsx).
    static let newNoteWidth: CGFloat = 240
    static let newNoteHeight: CGFloat = 56
    /// `NodeResizer`'s `minWidth`/`minHeight` in NoteNode.tsx.
    static let minWidth: CGFloat = 220
    static let minHeight: CGFloat = 56
    /// React Flow's `minZoom`/`maxZoom` on the web board.
    static let minZoom: CGFloat = 0.1
    static let maxZoom: CGFloat = 2
}

/// A fresh lowercase UUID string — the same format `crypto.randomUUID()`
/// produces on the web side. `nodes.id`/`edges.id` are `uuid` columns, and
/// generating them client-side is intentional (see docs/database.md).
func newRowID() -> String {
    UUID().uuidString.lowercased()
}
