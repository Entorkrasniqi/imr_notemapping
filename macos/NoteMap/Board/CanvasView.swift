import AppKit
import Combine
import UniformTypeIdentifiers

/// Pan/zoom state: a canvas point `p` is drawn at `p * zoom + offset`.
struct Viewport: Equatable {
    var offset: CGPoint = .zero
    var zoom: CGFloat = 1

    func toView(_ point: CGPoint) -> CGPoint {
        CGPoint(x: point.x * zoom + offset.x, y: point.y * zoom + offset.y)
    }

    func toFlow(_ point: CGPoint) -> CGPoint {
        CGPoint(x: (point.x - offset.x) / zoom, y: (point.y - offset.y) / zoom)
    }
}

/// The infinite canvas — the native stand-in for the web board's
/// `<ReactFlow>` with its `NoteNode`/`DeletableEdge` types, `<Background>`,
/// and `<MiniMap>`. One AppKit view draws everything and handles every
/// gesture itself: SwiftUI has no scroll-wheel or pinch events on macOS 13,
/// and a canvas of hundreds of notes is cheaper to draw than to lay out as
/// hundreds of views.
///
/// Interaction mirrors the web board: click a note to open it, drag to
/// move, drag its (invisible) corners/sides to resize while selected, drag
/// from just outside its border to connect, double-click empty canvas to
/// add a note, Delete/Backspace to remove the selection. Two things are
/// Mac-specific additions: two-finger trackpad scrolling pans (pinch or
/// ⌘-scroll zooms; a mouse wheel still zooms, as on the web), and
/// Shift-drag on empty canvas draws a selection box as React Flow's
/// `selectionKeyCode` does.
final class CanvasView: NSView {
    private let store: BoardStore
    private var cancellables: Set<AnyCancellable> = []

    var theme: Theme = .light {
        didSet {
            guard theme != oldValue else { return }
            tileCache.removeAll()
            needsDisplay = true
        }
    }

    private(set) var viewport = Viewport() {
        didSet { needsDisplay = true }
    }

    private enum Interaction {
        case idle
        case pressNode(id: String, start: CGPoint, additive: Bool, dragging: Bool, origins: [String: CGPoint])
        case resize(id: String, handle: ResizeHandle, startFrame: CGRect, startPoint: CGPoint)
        case connect(sourceID: String, sourceHandle: NoteHandles.Handle, pointer: CGPoint,
                     target: (id: String, handle: NoteHandles.Handle)?)
        case pan(start: CGPoint, startOffset: CGPoint, moved: Bool)
        case marquee(start: CGPoint, current: CGPoint, base: Set<String>)
        case minimap(last: CGPoint)
    }

    private struct ResizeHandle {
        let left: Bool
        let right: Bool
        let top: Bool
        let bottom: Bool
    }

    private enum HitTarget {
        case minimap
        case edgeDeleteButton(String)
        case nodeDeleteButton(String)
        case resize(String, ResizeHandle)
        case connect(String, NoteHandles.Handle)
        case node(String)
        case edge(String)
        case pane
    }

    private var interaction = Interaction.idle
    private var hoveredNodeID: String? {
        didSet { if hoveredNodeID != oldValue { needsDisplay = true } }
    }
    private var dropTargetNodeID: String? {
        didSet { if dropTargetNodeID != oldValue { needsDisplay = true } }
    }
    private var tileCache: [String: TileRender] = [:]
    private var trackingArea: NSTrackingArea?

    private var animationTimer: Timer?
    private var animationStart = Viewport()
    private var animationTarget = Viewport()
    private var animationStartTime: CFTimeInterval = 0
    private var animationDuration: CFTimeInterval = 0

    // Sizes from the web canvas (React Flow defaults and NoteNode.tsx).
    private static let connectionRadius: CGFloat = 20
    private static let dotGap: CGFloat = 20
    private static let minimapSize = CGSize(width: 200, height: 150)
    private static let panelMargin: CGFloat = 15
    private static let dragThreshold: CGFloat = 3

    init(store: BoardStore) {
        self.store = store
        super.init(frame: .zero)
        wantsLayer = true
        layerContentsRedrawPolicy = .onSetNeedsDisplay
        registerForDraggedTypes([.fileURL])
        setAccessibilityRole(.group)
        setAccessibilityLabel("Board canvas")

        store.objectWillChange
            .sink { [weak self] _ in self?.needsDisplay = true }
            .store(in: &cancellables)
        // Hand keyboard focus back to the canvas once the editor closes, so
        // Delete/⌘Z act on the board again straight away.
        store.$editingNoteID
            .removeDuplicates()
            .sink { [weak self] id in
                guard id == nil else { return }
                Task { @MainActor [weak self] in
                    guard let self, let window = self.window else { return }
                    window.makeFirstResponder(self)
                }
            }
            .store(in: &cancellables)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    private var palette: ThemePalette { theme.palette }

    /// While the note editor is open, the canvas underneath is inert — the
    /// equivalent of the web modal's click-catching backdrop.
    private var isBlocked: Bool { store.editingNoteID != nil }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil { window?.makeFirstResponder(self) }
    }

    // MARK: - Geometry helpers

    private var viewCenter: CGPoint { CGPoint(x: bounds.midX, y: bounds.midY) }

    private var visibleFlowRect: CGRect {
        let origin = viewport.toFlow(.zero)
        return CGRect(x: origin.x, y: origin.y, width: bounds.width / viewport.zoom, height: bounds.height / viewport.zoom)
    }

    private var nodesBounds: CGRect? {
        store.nodes.map(\.frame).reduce(nil) { partial, frame in partial?.union(frame) ?? frame }
    }

    /// Notes back to front: array order, with selected notes raised on top
    /// (React Flow's `elevateNodesOnSelect`).
    private var drawOrder: [NoteNode] {
        let selected = store.selectedNodeIDs
        return store.nodes.filter { !selected.contains($0.id) } + store.nodes.filter { selected.contains($0.id) }
    }

    private func route(for edge: BoardEdge, nodes: [String: NoteNode]) -> EdgeRoute? {
        guard
            let source = nodes[edge.source], let target = nodes[edge.target],
            let sourceHandle = NoteHandles.handle(id: edge.sourceHandle),
            let targetHandle = NoteHandles.handle(id: edge.targetHandle)
        else { return nil }
        return SmoothStep.route(
            source: sourceHandle.anchor(in: source.frame), sourceSide: sourceHandle.side,
            target: targetHandle.anchor(in: target.frame), targetSide: targetHandle.side
        )
    }

    private var nodesByID: [String: NoteNode] {
        Dictionary(uniqueKeysWithValues: store.nodes.map { ($0.id, $0) })
    }

    private func deleteButtonRect(for frame: CGRect) -> CGRect {
        CGRect(x: frame.maxX - 6 - 20, y: frame.minY + 6, width: 20, height: 20)
    }

    private func resizeHandle(at point: CGPoint, for frame: CGRect) -> ResizeHandle? {
        // Corners first — they win over the side bands and over the
        // connection handles, as NodeResizer does by rendering last.
        let corner: CGFloat = 10
        for (x, left) in [(frame.minX, true), (frame.maxX, false)] {
            for (y, top) in [(frame.minY, true), (frame.maxY, false)] {
                if abs(point.x - x) <= corner && abs(point.y - y) <= corner {
                    return ResizeHandle(left: left, right: !left, top: top, bottom: !top)
                }
            }
        }
        let band: CGFloat = 4
        let withinX = point.x >= frame.minX && point.x <= frame.maxX
        let withinY = point.y >= frame.minY && point.y <= frame.maxY
        if withinY && abs(point.x - frame.minX) <= band { return ResizeHandle(left: true, right: false, top: false, bottom: false) }
        if withinY && abs(point.x - frame.maxX) <= band { return ResizeHandle(left: false, right: true, top: false, bottom: false) }
        if withinX && abs(point.y - frame.minY) <= band { return ResizeHandle(left: false, right: false, top: true, bottom: false) }
        if withinX && abs(point.y - frame.maxY) <= band { return ResizeHandle(left: false, right: false, top: false, bottom: true) }
        return nil
    }

    private func hitTest(viewPoint: CGPoint) -> HitTarget {
        if minimapRect.contains(viewPoint) { return .minimap }
        let point = viewport.toFlow(viewPoint)
        let nodes = nodesByID

        for edge in store.edges where store.selectedEdgeIDs.contains(edge.id) {
            if let route = route(for: edge, nodes: nodes), point.distance(to: route.label) <= 10 {
                return .edgeDeleteButton(edge.id)
            }
        }

        let ring = NoteHandles.gap + NoteHandles.edgeSize / 2
        for node in drawOrder.reversed() {
            let frame = node.frame
            if store.selectedNodeIDs.contains(node.id) {
                if deleteButtonRect(for: frame).contains(point) { return .nodeDeleteButton(node.id) }
                if let handle = resizeHandle(at: point, for: frame) { return .resize(node.id, handle) }
            }
            if frame.insetBy(dx: -ring, dy: -ring).contains(point) && !frame.insetBy(dx: 2, dy: 2).contains(point),
               let closest = NoteHandles.closest(to: point, in: frame, within: ring + 2) {
                return .connect(node.id, closest.handle)
            }
            if frame.contains(point) { return .node(node.id) }
        }

        let tolerance = max(10, 4 / viewport.zoom)
        for edge in store.edges.reversed() {
            if let route = route(for: edge, nodes: nodes), route.distance(to: point) <= tolerance {
                return .edge(edge.id)
            }
        }
        return .pane
    }

    // MARK: - Viewport control

    private func clampZoom(_ zoom: CGFloat) -> CGFloat {
        min(max(zoom, NoteMetrics.minZoom), NoteMetrics.maxZoom)
    }

    func zoom(by factor: CGFloat, around viewPoint: CGPoint, animated: Bool = false) {
        let zoom = clampZoom(viewport.zoom * factor)
        let anchor = viewport.toFlow(viewPoint)
        let target = Viewport(offset: CGPoint(x: viewPoint.x - anchor.x * zoom, y: viewPoint.y - anchor.y * zoom), zoom: zoom)
        animate(to: target, duration: animated ? 0.15 : 0)
    }

    /// React Flow's `zoomIn()`/`zoomOut()` step.
    func zoomIn() { zoom(by: 1.2, around: viewCenter, animated: true) }
    func zoomOut() { zoom(by: 1 / 1.2, around: viewCenter, animated: true) }

    /// `fitView` — the toolbar's button uses padding 0.2 (Board.tsx), the
    /// bottom-left controls React Flow's default of 0.1.
    func fitView(padding: CGFloat = 0.2, animated: Bool = true) {
        guard let content = nodesBounds, bounds.width > 0, bounds.height > 0 else { return }
        let zoom = clampZoom(min(
            bounds.width / (max(content.width, 1) * (1 + padding)),
            bounds.height / (max(content.height, 1) * (1 + padding))
        ))
        let target = Viewport(
            offset: CGPoint(x: bounds.width / 2 - content.midX * zoom, y: bounds.height / 2 - content.midY * zoom),
            zoom: zoom
        )
        animate(to: target, duration: animated ? 0.2 : 0)
    }

    /// "+ Add note": a new note in the middle of what's currently visible.
    func addNoteAtCenter() {
        guard store.status == .ready, !isBlocked else { return }
        store.addNote(centeredAt: viewport.toFlow(viewCenter))
    }

    private func animate(to target: Viewport, duration: CFTimeInterval) {
        stopAnimation()
        guard duration > 0 else {
            viewport = target
            return
        }
        animationStart = viewport
        animationTarget = target
        animationStartTime = CACurrentMediaTime()
        animationDuration = duration
        animationTimer = Timer.scheduledTimer(timeInterval: 1.0 / 60.0, target: self,
                                              selector: #selector(animationStep), userInfo: nil, repeats: true)
    }

    @objc private func animationStep() {
        let t = min(1, (CACurrentMediaTime() - animationStartTime) / animationDuration)
        // d3's default `easeCubicInOut`, which React Flow's animated
        // viewport transitions use.
        let eased = t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2
        let e = CGFloat(eased)
        viewport = Viewport(
            offset: CGPoint(
                x: animationStart.offset.x + (animationTarget.offset.x - animationStart.offset.x) * e,
                y: animationStart.offset.y + (animationTarget.offset.y - animationStart.offset.y) * e
            ),
            zoom: animationStart.zoom + (animationTarget.zoom - animationStart.zoom) * e
        )
        if t >= 1 { stopAnimation() }
    }

    private func stopAnimation() {
        animationTimer?.invalidate()
        animationTimer = nil
    }

    // MARK: - Drawing

    override func draw(_ dirtyRect: NSRect) {
        guard let context = NSGraphicsContext.current?.cgContext else { return }
        palette.canvasBackground.setFill()
        dirtyRect.intersection(bounds).fill()
        drawDots(in: dirtyRect, context: context)

        let nodes = nodesByID
        context.saveGState()
        context.translateBy(x: viewport.offset.x, y: viewport.offset.y)
        context.scaleBy(x: viewport.zoom, y: viewport.zoom)

        for edge in store.edges {
            guard let route = route(for: edge, nodes: nodes) else { continue }
            drawEdge(route, selected: store.selectedEdgeIDs.contains(edge.id), context: context)
        }
        if case .connect(let sourceID, let sourceHandle, let pointer, let target) = interaction,
           let source = nodes[sourceID] {
            drawConnectionLine(from: sourceHandle.anchor(in: source.frame), side: sourceHandle.side,
                               to: target.flatMap { t in nodes[t.id].map { t.handle.anchor(in: $0.frame) } } ?? pointer,
                               targetSide: target?.handle.side ?? sourceHandle.side.opposite, context: context)
        }
        for node in drawOrder {
            drawNote(node, context: context)
        }
        for edge in store.edges where store.selectedEdgeIDs.contains(edge.id) {
            if let route = route(for: edge, nodes: nodes) { drawEdgeDeleteButton(at: route.label) }
        }
        context.restoreGState()

        if case .marquee(let start, let current, _) = interaction {
            let rect = CGRect(x: min(start.x, current.x), y: min(start.y, current.y),
                              width: abs(current.x - start.x), height: abs(current.y - start.y))
            NSColor(srgbRed: 0, green: 89 / 255, blue: 220 / 255, alpha: 0.08).setFill()
            rect.fill()
            let border = NSBezierPath(rect: rect.insetBy(dx: 0.5, dy: 0.5))
            border.setLineDash([2, 2], count: 2, phase: 0)
            NSColor(srgbRed: 0, green: 89 / 255, blue: 220 / 255, alpha: 0.8).setStroke()
            border.stroke()
        }

        drawMinimap(context: context)
    }

    private func drawDots(in dirtyRect: CGRect, context: CGContext) {
        let gap = Self.dotGap * viewport.zoom
        // AppKit can hand `draw(_:)` an unbounded rect (offscreen caching
        // does), which would make the loops below run forever — only ever
        // fill what's actually on screen, and never more than a sane
        // number of dots.
        let area = dirtyRect.intersection(bounds)
        guard gap >= 6, !area.isNull, area.width.isFinite, area.height.isFinite,
              (area.width / gap) * (area.height / gap) < 50_000 else { return }
        let radius = max(0.5 * viewport.zoom, 0.5)
        var startX = viewport.offset.x.truncatingRemainder(dividingBy: gap)
        var startY = viewport.offset.y.truncatingRemainder(dividingBy: gap)
        if startX < 0 { startX += gap }
        if startY < 0 { startY += gap }
        startX += (((area.minX - startX) / gap).rounded(.down)) * gap
        startY += (((area.minY - startY) / gap).rounded(.down)) * gap

        let path = CGMutablePath()
        var x = startX
        while x <= area.maxX + radius {
            var y = startY
            while y <= area.maxY + radius {
                path.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                y += gap
            }
            x += gap
        }
        context.addPath(path)
        context.setFillColor(palette.canvasDots.cgColor)
        context.fillPath()
    }

    private func drawEdge(_ route: EdgeRoute, selected: Bool, context: CGContext) {
        let width: CGFloat = selected ? 2.5 : 1.5
        context.addPath(route.cgPath())
        context.setStrokeColor((selected ? ThemePalette.edgeSelected : ThemePalette.edge).cgColor)
        context.setLineWidth(width)
        context.setLineJoin(.round)
        context.strokePath()

        // React Flow's `ArrowClosed` marker: `markerUnits="strokeWidth"`, so
        // it scales with the line, and its color is fixed (#a1a1aa) even
        // on a selected edge.
        guard route.points.count >= 2 else { return }
        let tip = route.points[route.points.count - 1]
        let before = route.points[route.points.count - 2]
        let angle = atan2(tip.y - before.y, tip.x - before.x)
        let scale = width * 12.5 / 20
        context.saveGState()
        context.translateBy(x: tip.x, y: tip.y)
        context.rotate(by: angle)
        context.scaleBy(x: scale, y: scale)
        context.move(to: CGPoint(x: -5, y: -4))
        context.addLine(to: .zero)
        context.addLine(to: CGPoint(x: -5, y: 4))
        context.closePath()
        context.setFillColor(ThemePalette.edge.cgColor)
        context.setStrokeColor(ThemePalette.edge.cgColor)
        context.setLineWidth(1)
        context.drawPath(using: .fillStroke)
        context.restoreGState()
    }

    private func drawConnectionLine(from source: CGPoint, side: HandleSide, to target: CGPoint,
                                    targetSide: HandleSide, context: CGContext) {
        context.addPath(SmoothStep.bezier(from: source, sourceSide: side, to: target, targetSide: targetSide))
        context.setStrokeColor(NSColor(hex: 0xb1b1b7).cgColor)
        context.setLineWidth(1)
        context.strokePath()
    }

    private func drawEdgeDeleteButton(at center: CGPoint) {
        let rect = CGRect(x: center.x - 10, y: center.y - 10, width: 20, height: 20)
        let circle = NSBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5))
        NSColor.white.setFill()
        circle.fill()
        NSColor(hex: 0xe4e4e7).setStroke()
        circle.lineWidth = 1
        circle.stroke()
        drawCentered("✕", in: rect, font: .systemFont(ofSize: 10), color: NSColor(hex: 0x71717a))
    }

    private func tile(for node: NoteNode) -> TileRender {
        if let cached = tileCache[node.id], cached.revision == node.contentRevision { return cached }
        let render = TilePreview.render(node.content, revision: node.contentRevision, theme: theme)
        tileCache[node.id] = render
        return render
    }

    private func drawNote(_ node: NoteNode, context: CGContext) {
        let frame = node.frame
        let selected = store.selectedNodeIDs.contains(node.id)

        // The one visible connection cue: a rounded outline 6pt outside the
        // note, on hover or while selected. The note itself has no box.
        if selected || hoveredNodeID == node.id {
            let outline = NSBezierPath(roundedRect: frame.insetBy(dx: -5, dy: -5), xRadius: 11, yRadius: 11)
            outline.lineWidth = 2
            palette.noteOutline.setStroke()
            outline.stroke()
        }
        if dropTargetNodeID == node.id {
            let outline = NSBezierPath(rect: frame.insetBy(dx: -5, dy: -5))
            outline.lineWidth = 2
            outline.setLineDash([6, 4], count: 2, phase: 0)
            palette.dropOutline.setStroke()
            outline.stroke()
        }

        context.saveGState()
        context.clip(to: frame)
        let inner = frame.insetBy(dx: 12, dy: 12)
        let textBox = inner.insetBy(dx: 8, dy: 8)
        let render = tile(for: node)

        switch render.content {
        case .placeholder:
            drawCentered("Type something…", in: textBox, font: .systemFont(ofSize: 14), color: palette.notePlaceholder)
        case .text(let text):
            let height = text.boundingRect(
                with: CGSize(width: max(textBox.width, 1), height: 10_000),
                options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine]
            ).height
            let rect = CGRect(x: textBox.minX, y: textBox.midY - height / 2, width: textBox.width, height: height)
            text.draw(with: rect, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine])
        case .image(let image):
            if let image, image.size.width > 0 {
                let width = min(textBox.width, image.size.width)
                let height = width * image.size.height / image.size.width
                context.saveGState()
                context.clip(to: inner)
                image.draw(in: CGRect(x: textBox.midX - width / 2, y: textBox.midY - height / 2, width: width, height: height),
                           from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
                context.restoreGState()
            } else {
                drawCentered("Image", in: textBox, font: .systemFont(ofSize: 14), color: palette.notePlaceholder)
            }
        }

        if render.hasMore {
            drawCentered("···", in: CGRect(x: inner.minX, y: inner.maxY - 20, width: inner.width, height: 20),
                         font: .systemFont(ofSize: 14), color: palette.noteMoreHint)
        }
        if selected {
            drawCentered("✕", in: deleteButtonRect(for: frame), font: .systemFont(ofSize: 12), color: palette.noteDeleteGlyph)
        }
        context.restoreGState()
    }

    private func drawCentered(_ string: String, in rect: CGRect, font: NSFont, color: NSColor) {
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        style.lineBreakMode = .byTruncatingTail
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
        let height = (string as NSString).size(withAttributes: attributes).height
        (string as NSString).draw(
            with: CGRect(x: rect.minX, y: rect.midY - height / 2, width: rect.width, height: height),
            options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: attributes
        )
    }

    // MARK: - Minimap

    private var minimapRect: CGRect {
        CGRect(x: bounds.maxX - Self.panelMargin - Self.minimapSize.width,
               y: bounds.maxY - Self.panelMargin - Self.minimapSize.height,
               width: Self.minimapSize.width, height: Self.minimapSize.height)
    }

    /// React Flow's MiniMap layout: the union of all notes and the visible
    /// area, scaled to fit, with a 5-unit border.
    private func minimapMapping() -> (origin: CGPoint, scale: CGFloat, inset: CGPoint) {
        let view = visibleFlowRect
        let bounding = nodesBounds.map { $0.union(view) } ?? view
        let size = Self.minimapSize
        let viewScale = max(bounding.width / size.width, bounding.height / size.height)
        let offset = 5 * viewScale
        let width = viewScale * size.width + offset * 2
        let height = viewScale * size.height + offset * 2
        let origin = CGPoint(x: bounding.minX - (viewScale * size.width - bounding.width) / 2 - offset,
                             y: bounding.minY - (viewScale * size.height - bounding.height) / 2 - offset)
        let scale = min(size.width / width, size.height / height)
        let inset = CGPoint(x: (size.width - width * scale) / 2, y: (size.height - height * scale) / 2)
        return (origin, scale, inset)
    }

    private func drawMinimap(context: CGContext) {
        let panel = minimapRect
        guard panel.minX > 0, panel.minY > 0 else { return }
        let mapping = minimapMapping()
        func map(_ rect: CGRect) -> CGRect {
            CGRect(x: panel.minX + mapping.inset.x + (rect.minX - mapping.origin.x) * mapping.scale,
                   y: panel.minY + mapping.inset.y + (rect.minY - mapping.origin.y) * mapping.scale,
                   width: rect.width * mapping.scale, height: rect.height * mapping.scale)
        }

        context.saveGState()
        context.clip(to: panel)
        palette.minimapBackground.setFill()
        panel.fill()
        palette.minimapNode.setFill()
        for node in store.nodes {
            let radius = 5 * mapping.scale
            NSBezierPath(roundedRect: map(node.frame), xRadius: radius, yRadius: radius).fill()
        }
        let mask = NSBezierPath(rect: panel)
        mask.append(NSBezierPath(rect: map(visibleFlowRect)))
        mask.windingRule = .evenOdd
        palette.minimapMask.setFill()
        mask.fill()
        context.restoreGState()
    }

    // MARK: - Mouse

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let trackingArea { removeTrackingArea(trackingArea) }
        let area = NSTrackingArea(rect: .zero, options: [.mouseMoved, .mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect],
                                  owner: self, userInfo: nil)
        addTrackingArea(area)
        trackingArea = area
    }

    override func mouseMoved(with event: NSEvent) {
        guard !isBlocked else { return }
        let point = convert(event.locationInWindow, from: nil)
        let target = hitTest(viewPoint: point)
        switch target {
        case .node(let id), .resize(let id, _), .connect(let id, _), .nodeDeleteButton(let id): hoveredNodeID = id
        default: hoveredNodeID = nil
        }
        cursor(for: target).set()
    }

    override func mouseExited(with event: NSEvent) {
        hoveredNodeID = nil
        NSCursor.arrow.set()
    }

    private func cursor(for target: HitTarget) -> NSCursor {
        switch target {
        case .resize(_, let handle):
            let horizontal = handle.left || handle.right
            let vertical = handle.top || handle.bottom
            if horizontal && !vertical { return .resizeLeftRight }
            if vertical && !horizontal { return .resizeUpDown }
            return .crosshair
        case .connect: return .crosshair
        case .node, .pane: return .openHand
        case .edge, .edgeDeleteButton, .nodeDeleteButton: return .pointingHand
        case .minimap: return .arrow
        }
    }

    override func mouseDown(with event: NSEvent) {
        guard !isBlocked else { return }
        window?.makeFirstResponder(self)
        stopAnimation()
        let point = convert(event.locationInWindow, from: nil)
        let flowPoint = viewport.toFlow(point)
        let additive = event.modifierFlags.contains(.shift) || event.modifierFlags.contains(.command)

        switch hitTest(viewPoint: point) {
        case .minimap:
            interaction = .minimap(last: point)
        case .edgeDeleteButton(let id):
            store.deleteElements(nodeIDs: [], edgeIDs: [id])
        case .nodeDeleteButton(let id):
            store.deleteElements(nodeIDs: [id], edgeIDs: [])
        case .resize(let id, let handle):
            guard let node = store.node(id) else { return }
            store.recordBeforeChange()
            interaction = .resize(id: id, handle: handle, startFrame: node.frame, startPoint: flowPoint)
        case .connect(let id, let handle):
            interaction = .connect(sourceID: id, sourceHandle: handle, pointer: flowPoint, target: nil)
        case .node(let id):
            interaction = .pressNode(id: id, start: point, additive: additive, dragging: false, origins: [:])
        case .edge(let id):
            if event.clickCount == 2 {
                store.addNote(centeredAt: flowPoint)
            } else if additive {
                var edges = store.selectedEdgeIDs
                if edges.contains(id) { edges.remove(id) } else { edges.insert(id) }
                store.select(nodeIDs: store.selectedNodeIDs, edgeIDs: edges)
            } else {
                store.select(nodeIDs: [], edgeIDs: [id])
            }
        case .pane:
            if event.clickCount == 2 {
                store.addNote(centeredAt: flowPoint)
            } else if event.modifierFlags.contains(.shift) {
                interaction = .marquee(start: point, current: point, base: store.selectedNodeIDs)
            } else {
                interaction = .pan(start: point, startOffset: viewport.offset, moved: false)
                NSCursor.closedHand.set()
            }
        }
    }

    override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let flowPoint = viewport.toFlow(point)

        switch interaction {
        case .idle:
            break

        case .pressNode(let id, let start, let additive, var dragging, var origins):
            if !dragging {
                guard point.distance(to: start) >= Self.dragThreshold else { return }
                // Dragging an unselected note selects just it, as in React Flow.
                if !store.selectedNodeIDs.contains(id) { store.select(nodeIDs: [id]) }
                store.recordBeforeChange()
                for node in store.nodes where store.selectedNodeIDs.contains(node.id) {
                    origins[node.id] = node.position
                }
                dragging = true
                interaction = .pressNode(id: id, start: start, additive: additive, dragging: true, origins: origins)
                NSCursor.closedHand.set()
            }
            let delta = CGPoint(x: (point.x - start.x) / viewport.zoom, y: (point.y - start.y) / viewport.zoom)
            store.setPositions(origins.mapValues { CGPoint(x: $0.x + delta.x, y: $0.y + delta.y) })

        case .resize(let id, let handle, let startFrame, let startPoint):
            let dx = flowPoint.x - startPoint.x
            let dy = flowPoint.y - startPoint.y
            var minX = startFrame.minX, maxX = startFrame.maxX, minY = startFrame.minY, maxY = startFrame.maxY
            if handle.left { minX = min(startFrame.minX + dx, startFrame.maxX - NoteMetrics.minWidth) }
            if handle.right { maxX = max(startFrame.maxX + dx, startFrame.minX + NoteMetrics.minWidth) }
            if handle.top { minY = min(startFrame.minY + dy, startFrame.maxY - NoteMetrics.minHeight) }
            if handle.bottom { maxY = max(startFrame.maxY + dy, startFrame.minY + NoteMetrics.minHeight) }
            store.setFrame(id, CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY))

        case .connect(let sourceID, let sourceHandle, _, _):
            var best: (id: String, handle: NoteHandles.Handle, distance: CGFloat)?
            for node in store.nodes {
                guard node.frame.insetBy(dx: -Self.connectionRadius - 20, dy: -Self.connectionRadius - 20).contains(flowPoint),
                      let closest = NoteHandles.closest(to: flowPoint, in: node.frame, within: Self.connectionRadius)
                else { continue }
                // React Flow only skips the exact handle the drag began on.
                if node.id == sourceID && closest.handle.id == sourceHandle.id { continue }
                if closest.distance < (best?.distance ?? .infinity) { best = (node.id, closest.handle, closest.distance) }
            }
            interaction = .connect(sourceID: sourceID, sourceHandle: sourceHandle, pointer: flowPoint,
                                   target: best.map { (id: $0.id, handle: $0.handle) })
            needsDisplay = true

        case .pan(let start, let startOffset, _):
            viewport.offset = CGPoint(x: startOffset.x + point.x - start.x, y: startOffset.y + point.y - start.y)
            interaction = .pan(start: start, startOffset: startOffset, moved: true)

        case .marquee(let start, _, let base):
            interaction = .marquee(start: start, current: point, base: base)
            let a = viewport.toFlow(start)
            let rect = CGRect(x: min(a.x, flowPoint.x), y: min(a.y, flowPoint.y),
                              width: abs(flowPoint.x - a.x), height: abs(flowPoint.y - a.y))
            // React Flow's default `SelectionMode.Full`: fully enclosed only.
            let enclosed = store.nodes.filter { rect.contains($0.frame) }.map(\.id)
            store.select(nodeIDs: base.union(enclosed))
            needsDisplay = true

        case .minimap(let last):
            let mapping = minimapMapping()
            let dx = (point.x - last.x) / mapping.scale * viewport.zoom
            let dy = (point.y - last.y) / mapping.scale * viewport.zoom
            viewport.offset = CGPoint(x: viewport.offset.x - dx, y: viewport.offset.y - dy)
            interaction = .minimap(last: point)
        }
    }

    override func mouseUp(with event: NSEvent) {
        switch interaction {
        case .pressNode(let id, _, let additive, let dragging, _) where !dragging:
            if additive {
                var selection = store.selectedNodeIDs
                if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
                store.select(nodeIDs: selection, edgeIDs: store.selectedEdgeIDs)
            } else {
                // A plain click opens the note (`handleNodeClick`); a real
                // drag never gets here, same as React Flow's click/drag split.
                store.select(nodeIDs: [id])
                store.editingNoteID = id
            }
        case .connect(let sourceID, let sourceHandle, _, let target):
            if let target {
                store.connect(source: sourceID, sourceHandle: sourceHandle.id, target: target.id, targetHandle: target.handle.id)
            }
        case .pan(_, _, let moved) where !moved:
            store.select(nodeIDs: [], edgeIDs: [])
        default:
            break
        }
        interaction = .idle
        needsDisplay = true
        if !isBlocked { cursor(for: hitTest(viewPoint: convert(event.locationInWindow, from: nil))).set() }
    }

    override func scrollWheel(with event: NSEvent) {
        guard !isBlocked else { return }
        stopAnimation()
        let point = convert(event.locationInWindow, from: nil)
        let precise = event.hasPreciseScrollingDeltas

        if minimapRect.contains(point) {
            let factor = pow(2, event.scrollingDeltaY * (precise ? 0.02 : 0.5))
            zoom(by: factor, around: viewCenter)
            return
        }
        if event.modifierFlags.contains(.command) || !precise {
            let factor = pow(2, event.scrollingDeltaY * (precise ? 0.01 : 0.15))
            zoom(by: factor, around: point)
        } else {
            viewport.offset = CGPoint(x: viewport.offset.x + event.scrollingDeltaX, y: viewport.offset.y + event.scrollingDeltaY)
        }
    }

    override func magnify(with event: NSEvent) {
        guard !isBlocked else { return }
        stopAnimation()
        zoom(by: 1 + event.magnification, around: convert(event.locationInWindow, from: nil))
    }

    // MARK: - Keyboard and menu actions

    override func keyDown(with event: NSEvent) {
        guard !isBlocked else { return }
        switch event.keyCode {
        case 51, 117: // Backspace, forward Delete — React Flow's `deleteKeyCode`
            store.deleteSelection()
        default:
            super.keyDown(with: event)
        }
    }

    @objc func undo(_ sender: Any?) { store.undo() }
    @objc func redo(_ sender: Any?) { store.redo() }
    @objc func delete(_ sender: Any?) { store.deleteSelection() }
    override func selectAll(_ sender: Any?) { store.selectAll() }

    // MARK: - Dropping a JPEG onto a note

    private func droppedJPEG(_ info: NSDraggingInfo) -> URL? {
        let urls = info.draggingPasteboard.readObjects(forClasses: [NSURL.self],
                                                       options: [.urlReadingFileURLsOnly: true]) as? [URL]
        guard let url = urls?.first, let type = UTType(filenameExtension: url.pathExtension), type.conforms(to: .jpeg)
        else { return nil }
        return url
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        draggingUpdated(sender)
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        guard !isBlocked, droppedJPEG(sender) != nil else {
            dropTargetNodeID = nil
            return []
        }
        let point = viewport.toFlow(convert(sender.draggingLocation, from: nil))
        dropTargetNodeID = drawOrder.reversed().first { $0.frame.contains(point) }?.id
        return dropTargetNodeID == nil ? [] : .copy
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        dropTargetNodeID = nil
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        defer { dropTargetNodeID = nil }
        guard let id = dropTargetNodeID, let url = droppedJPEG(sender) else { return false }
        do {
            store.appendImage(to: id, src: try NoteContent.dataURL(forJPEGAt: url))
            return true
        } catch {
            presentError(error)
            return false
        }
    }
}

extension CanvasView: NSMenuItemValidation {
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        switch menuItem.action {
        case #selector(undo(_:)): return !isBlocked && store.canUndo
        case #selector(redo(_:)): return !isBlocked && store.canRedo
        case #selector(delete(_:)): return !isBlocked && !(store.selectedNodeIDs.isEmpty && store.selectedEdgeIDs.isEmpty)
        case #selector(selectAll(_:)): return !isBlocked && !store.nodes.isEmpty
        default: return true
        }
    }
}
