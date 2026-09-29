import CoreGraphics

enum HandleSide {
    case top, right, bottom, left

    var opposite: HandleSide {
        switch self {
        case .top: return .bottom
        case .right: return .left
        case .bottom: return .top
        case .left: return .right
        }
    }

    /// React Flow's `handleDirections`.
    var direction: CGPoint {
        switch self {
        case .left: return CGPoint(x: -1, y: 0)
        case .right: return CGPoint(x: 1, y: 0)
        case .top: return CGPoint(x: 0, y: -1)
        case .bottom: return CGPoint(x: 0, y: 1)
        }
    }
}

/// The forty connection points around every note, with the exact ids,
/// sizes, and offsets `NoteNode.tsx` gives its React Flow `<Handle>`s —
/// edges store these ids in `source_handle`/`target_handle`, so both
/// clients must agree on where each one sits.
enum NoteHandles {
    /// `HANDLE_GAP`, `CORNER_HANDLE_SIZE`, `EDGE_HANDLE_SIZE` in NoteNode.tsx.
    static let gap: CGFloat = 6
    static let cornerSize: CGFloat = 10
    static let edgeSize: CGFloat = 16

    struct Handle {
        enum Spec {
            case corner(right: Bool, bottom: Bool)
            case edge(fraction: CGFloat)
        }

        let id: String
        let side: HandleSide
        let spec: Spec

        /// The handle's box in canvas coordinates for a note at `node`.
        func box(in node: CGRect) -> CGRect {
            switch spec {
            case .corner(let right, let bottom):
                let size = NoteHandles.cornerSize
                let x = right ? node.maxX + gap - size / 2 : node.minX - gap - size / 2
                let y = bottom ? node.maxY + gap - size / 2 : node.minY - gap - size / 2
                return CGRect(x: x, y: y, width: size, height: size)
            case .edge(let t):
                let size = NoteHandles.edgeSize
                switch side {
                case .top:
                    return CGRect(x: node.minX + t * node.width - size / 2, y: node.minY - gap - size / 2, width: size, height: size)
                case .bottom:
                    return CGRect(x: node.minX + t * node.width - size / 2, y: node.maxY + gap - size / 2, width: size, height: size)
                case .left:
                    return CGRect(x: node.minX - gap - size / 2, y: node.minY + t * node.height - size / 2, width: size, height: size)
                case .right:
                    return CGRect(x: node.maxX + gap - size / 2, y: node.minY + t * node.height - size / 2, width: size, height: size)
                }
            }
        }

        /// Where an edge attaches: the middle of the handle box's outer side
        /// (`getHandlePosition` in @xyflow/system).
        func anchor(in node: CGRect) -> CGPoint {
            let box = self.box(in: node)
            switch side {
            case .top: return CGPoint(x: box.midX, y: box.minY)
            case .right: return CGPoint(x: box.maxX, y: box.midY)
            case .bottom: return CGPoint(x: box.midX, y: box.maxY)
            case .left: return CGPoint(x: box.minX, y: box.midY)
            }
        }

        /// Used to find the closest handle while dragging a connection.
        func center(in node: CGRect) -> CGPoint {
            let box = self.box(in: node)
            return CGPoint(x: box.midX, y: box.midY)
        }
    }

    private static let fractions: [(String, CGFloat)] = [
        ("0.1", 0.1), ("0.2", 0.2), ("0.3", 0.3), ("0.4", 0.4), ("0.5", 0.5),
        ("0.6", 0.6), ("0.7", 0.7), ("0.8", 0.8), ("0.9", 0.9),
    ]

    /// In the same order NoteNode.tsx renders them — React Flow falls back
    /// to the first one (`top-left`) for an edge with a `null` handle id.
    static let all: [Handle] = [
        Handle(id: "top-left", side: .top, spec: .corner(right: false, bottom: false)),
        Handle(id: "top-right", side: .top, spec: .corner(right: true, bottom: false)),
        Handle(id: "bottom-left", side: .bottom, spec: .corner(right: false, bottom: true)),
        Handle(id: "bottom-right", side: .bottom, spec: .corner(right: true, bottom: true)),
    ] + fractions.flatMap { name, t in [
        Handle(id: "top-\(name)", side: .top, spec: .edge(fraction: t)),
        Handle(id: "bottom-\(name)", side: .bottom, spec: .edge(fraction: t)),
        Handle(id: "left-\(name)", side: .left, spec: .edge(fraction: t)),
        Handle(id: "right-\(name)", side: .right, spec: .edge(fraction: t)),
    ] }

    private static let byID = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    /// `nil` for an id no note has — React Flow skips drawing such an edge
    /// (its error 008), and so does the native canvas.
    static func handle(id: String?) -> Handle? {
        guard let id else { return all[0] }
        return byID[id]
    }

    /// The handle closest to `point`, or `nil` if none is within `radius`
    /// (React Flow's `getClosestHandle`, `connectionRadius` = 20).
    static func closest(to point: CGPoint, in node: CGRect, within radius: CGFloat) -> (handle: Handle, distance: CGFloat)? {
        var best: (Handle, CGFloat)?
        for handle in all {
            let distance = point.distance(to: handle.center(in: node))
            if distance <= radius, distance < (best?.1 ?? .infinity) { best = (handle, distance) }
        }
        return best.map { (handle: $0.0, distance: $0.1) }
    }
}

/// A computed edge route.
struct EdgeRoute {
    /// Corner points before rounding — also what hit testing measures against.
    let points: [CGPoint]
    /// Midpoint along the longest segment, where the delete button goes.
    let label: CGPoint
    let targetSide: HandleSide

    func cgPath(borderRadius: CGFloat = 5) -> CGPath {
        let path = CGMutablePath()
        path.move(to: points[0])
        if points.count > 2 {
            for index in 1..<(points.count - 1) {
                SmoothStep.addBend(to: path, points[index - 1], points[index], points[index + 1], size: borderRadius)
            }
        }
        path.addLine(to: points[points.count - 1])
        return path
    }

    func distance(to point: CGPoint) -> CGFloat {
        var best = CGFloat.infinity
        for index in 1..<points.count {
            best = min(best, point.distance(toSegment: points[index - 1], points[index]))
        }
        return best
    }
}

/// A line-for-line port of React Flow's smooth-step routing (`getPoints`,
/// `getBend`, `getSmoothStepPath` in @xyflow/system) with its default
/// `offset` of 20, `stepPosition` of 0.5, and `borderRadius` of 5, so an
/// edge takes the same route on both clients.
enum SmoothStep {
    static func route(source: CGPoint, sourceSide: HandleSide, target: CGPoint, targetSide: HandleSide,
                      offset: CGFloat = 20, stepPosition: CGFloat = 0.5) -> EdgeRoute {
        let sourceDir = sourceSide.direction
        let targetDir = targetSide.direction
        let sourceGapped = CGPoint(x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset)
        let targetGapped = CGPoint(x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset)

        let dir: CGPoint
        if sourceSide == .left || sourceSide == .right {
            dir = sourceGapped.x < targetGapped.x ? CGPoint(x: 1, y: 0) : CGPoint(x: -1, y: 0)
        } else {
            dir = sourceGapped.y < targetGapped.y ? CGPoint(x: 0, y: 1) : CGPoint(x: 0, y: -1)
        }
        let horizontal = dir.x != 0
        let currDir = horizontal ? dir.x : dir.y
        func axis(_ point: CGPoint, _ horizontal: Bool) -> CGFloat { horizontal ? point.x : point.y }

        var points: [CGPoint]
        let centerX: CGFloat
        let centerY: CGFloat
        var sourceGapOffset = CGPoint.zero
        var targetGapOffset = CGPoint.zero

        if axis(sourceDir, horizontal) * axis(targetDir, horizontal) == -1 {
            // Opposite handle positions — the default case.
            if horizontal {
                centerX = sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition
                centerY = (sourceGapped.y + targetGapped.y) / 2
            } else {
                centerX = (sourceGapped.x + targetGapped.x) / 2
                centerY = sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition
            }
            let verticalSplit = [CGPoint(x: centerX, y: sourceGapped.y), CGPoint(x: centerX, y: targetGapped.y)]
            let horizontalSplit = [CGPoint(x: sourceGapped.x, y: centerY), CGPoint(x: targetGapped.x, y: centerY)]
            if axis(sourceDir, horizontal) == currDir {
                points = horizontal ? verticalSplit : horizontalSplit
            } else {
                points = horizontal ? horizontalSplit : verticalSplit
            }
        } else {
            let sourceTarget = [CGPoint(x: sourceGapped.x, y: targetGapped.y)]
            let targetSource = [CGPoint(x: targetGapped.x, y: sourceGapped.y)]
            if horizontal {
                points = sourceDir.x == currDir ? targetSource : sourceTarget
            } else {
                points = sourceDir.y == currDir ? sourceTarget : targetSource
            }

            if sourceSide == targetSide {
                let diff = abs(axis(source, horizontal) - axis(target, horizontal))
                if diff <= offset {
                    let gapOffset = min(offset - 1, offset - diff)
                    if axis(sourceDir, horizontal) == currDir {
                        let value = (axis(sourceGapped, horizontal) > axis(source, horizontal) ? -1 : 1) * gapOffset
                        if horizontal { sourceGapOffset.x = value } else { sourceGapOffset.y = value }
                    } else {
                        let value = (axis(targetGapped, horizontal) > axis(target, horizontal) ? -1 : 1) * gapOffset
                        if horizontal { targetGapOffset.x = value } else { targetGapOffset.y = value }
                    }
                }
            }

            if sourceSide != targetSide {
                let opposite = !horizontal
                let isSameDir = axis(sourceDir, horizontal) == axis(targetDir, opposite)
                let sourceGtTargetOppo = axis(sourceGapped, opposite) > axis(targetGapped, opposite)
                let sourceLtTargetOppo = axis(sourceGapped, opposite) < axis(targetGapped, opposite)
                let flipSourceTarget =
                    (axis(sourceDir, horizontal) == 1 && ((!isSameDir && sourceGtTargetOppo) || (isSameDir && sourceLtTargetOppo)))
                    || (axis(sourceDir, horizontal) != 1 && ((!isSameDir && sourceLtTargetOppo) || (isSameDir && sourceGtTargetOppo)))
                if flipSourceTarget {
                    points = horizontal ? sourceTarget : targetSource
                }
            }

            let sourceGapPoint = CGPoint(x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y)
            let targetGapPoint = CGPoint(x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y)
            let maxXDistance = max(abs(sourceGapPoint.x - points[0].x), abs(targetGapPoint.x - points[0].x))
            let maxYDistance = max(abs(sourceGapPoint.y - points[0].y), abs(targetGapPoint.y - points[0].y))
            if maxXDistance >= maxYDistance {
                centerX = (sourceGapPoint.x + targetGapPoint.x) / 2
                centerY = points[0].y
            } else {
                centerX = points[0].x
                centerY = (sourceGapPoint.y + targetGapPoint.y) / 2
            }
        }

        let gappedSource = CGPoint(x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y)
        let gappedTarget = CGPoint(x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y)
        var pathPoints = [source]
        if gappedSource != points[0] { pathPoints.append(gappedSource) }
        pathPoints += points
        if gappedTarget != points[points.count - 1] { pathPoints.append(gappedTarget) }
        pathPoints.append(target)
        return EdgeRoute(points: pathPoints, label: CGPoint(x: centerX, y: centerY), targetSide: targetSide)
    }

    /// `getBend`: a rounded corner at `b` between segments a→b and b→c.
    static func addBend(to path: CGMutablePath, _ a: CGPoint, _ b: CGPoint, _ c: CGPoint, size: CGFloat) {
        let bendSize = min(a.distance(to: b) / 2, b.distance(to: c) / 2, size)
        if (a.x == b.x && b.x == c.x) || (a.y == b.y && b.y == c.y) {
            path.addLine(to: b)
            return
        }
        if a.y == b.y {
            let xDir: CGFloat = a.x < c.x ? -1 : 1
            let yDir: CGFloat = a.y < c.y ? 1 : -1
            path.addLine(to: CGPoint(x: b.x + bendSize * xDir, y: b.y))
            path.addQuadCurve(to: CGPoint(x: b.x, y: b.y + bendSize * yDir), control: b)
        } else {
            let xDir: CGFloat = a.x < c.x ? 1 : -1
            let yDir: CGFloat = a.y < c.y ? -1 : 1
            path.addLine(to: CGPoint(x: b.x, y: b.y + bendSize * yDir))
            path.addQuadCurve(to: CGPoint(x: b.x + bendSize * xDir, y: b.y), control: b)
        }
    }

    /// React Flow's default connection-line shape while dragging a new
    /// connection (`getBezierPath`, curvature 0.25).
    static func bezier(from source: CGPoint, sourceSide: HandleSide, to target: CGPoint, targetSide: HandleSide) -> CGPath {
        func controlOffset(_ distance: CGFloat) -> CGFloat {
            distance >= 0 ? 0.5 * distance : 0.25 * 25 * (-distance).squareRoot()
        }
        func control(_ side: HandleSide, _ from: CGPoint, _ to: CGPoint) -> CGPoint {
            switch side {
            case .left: return CGPoint(x: from.x - controlOffset(from.x - to.x), y: from.y)
            case .right: return CGPoint(x: from.x + controlOffset(to.x - from.x), y: from.y)
            case .top: return CGPoint(x: from.x, y: from.y - controlOffset(from.y - to.y))
            case .bottom: return CGPoint(x: from.x, y: from.y + controlOffset(to.y - from.y))
            }
        }
        let path = CGMutablePath()
        path.move(to: source)
        path.addCurve(to: target, control1: control(sourceSide, source, target), control2: control(targetSide, target, source))
        return path
    }
}

extension CGPoint {
    func distance(to other: CGPoint) -> CGFloat {
        ((x - other.x) * (x - other.x) + (y - other.y) * (y - other.y)).squareRoot()
    }

    func distance(toSegment a: CGPoint, _ b: CGPoint) -> CGFloat {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else { return distance(to: a) }
        let t = max(0, min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared))
        return distance(to: CGPoint(x: a.x + t * dx, y: a.y + t * dy))
    }
}
