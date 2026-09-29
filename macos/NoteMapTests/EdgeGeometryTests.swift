import XCTest
@testable import NoteMap

/// Edges must route and attach exactly as on the web board.
final class EdgeGeometryTests: XCTestCase {
    private struct Case {
        let source: CGPoint
        let sourceSide: HandleSide
        let target: CGPoint
        let targetSide: HandleSide
        /// Every number in React Flow's SVG path, in order.
        let numbers: [CGFloat]
        let label: CGPoint
    }

    /// Output of `getSmoothStepPath` from @xyflow/system (the version in
    /// package-lock.json) for these inputs, captured with Node.
    private let reactFlowCases: [Case] = [
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .right, target: CGPoint(x: 200, y: 100), targetSide: .left,
             numbers: [0, 0, 20, 0, 95, 0, 100, 0, 100, 5, 100, 95, 100, 100, 105, 100, 180, 100, 200, 100],
             label: CGPoint(x: 100, y: 50)),
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .bottom, target: CGPoint(x: 100, y: 200), targetSide: .top,
             numbers: [0, 0, 0, 20, 0, 95, 0, 100, 5, 100, 95, 100, 100, 100, 100, 105, 100, 180, 100, 200],
             label: CGPoint(x: 50, y: 100)),
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .right, target: CGPoint(x: -100, y: 50), targetSide: .left,
             numbers: [0, 0, 15, 0, 20, 0, 20, 5, 20, 20, 20, 25, 15, 25, -115, 25, -120, 25, -120, 30, -120, 45,
                       -120, 50, -115, 50, -100, 50],
             label: CGPoint(x: -50, y: 25)),
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .right, target: CGPoint(x: 100, y: 100), targetSide: .right,
             numbers: [0, 0, 20, 0, 115, 0, 120, 0, 120, 5, 120, 95, 120, 100, 115, 100, 100, 100],
             label: CGPoint(x: 70, y: 0)),
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .right, target: CGPoint(x: 10, y: 5), targetSide: .right,
             numbers: [0, 0, 10, 0, 27.5, 0, 30, 0, 30, 2.5, 30, 2.5, 30, 5, 27.5, 5, 10, 5],
             label: CGPoint(x: 20, y: 0)),
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .right, target: CGPoint(x: 150, y: 120), targetSide: .top,
             numbers: [0, 0, 20, 0, 145, 0, 150, 0, 150, 5, 150, 100, 150, 120],
             label: CGPoint(x: 85, y: 0)),
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .top, target: CGPoint(x: 150, y: -120), targetSide: .left,
             numbers: [0, 0, 0, -20, 0, -115, 0, -120, 5, -120, 130, -120, 150, -120],
             label: CGPoint(x: 65, y: -120)),
        Case(source: CGPoint(x: 0, y: 0), sourceSide: .bottom, target: CGPoint(x: -80, y: 60), targetSide: .right,
             numbers: [0, 0, 0, 20, 0, 55, 0, 60, -5, 60, -60, 60, -80, 60],
             label: CGPoint(x: -30, y: 60)),
        Case(source: CGPoint(x: 50, y: 50), sourceSide: .left, target: CGPoint(x: 300, y: 40), targetSide: .bottom,
             numbers: [50, 50, 35, 50, 30, 50, 30, 55, 30, 55, 30, 60, 35, 60, 295, 60, 300, 60, 300, 55, 300, 40],
             label: CGPoint(x: 165, y: 60)),
        Case(source: CGPoint(x: 254, y: 28), sourceSide: .right, target: CGPoint(x: 286, y: -14), targetSide: .top,
             numbers: [254, 28, 269, 28, 274, 28, 274, 23, 274, -29, 274, -34, 279, -34, 281, -34, 286, -34, 286, -29, 286, -14],
             label: CGPoint(x: 274, y: -3)),
    ]

    private func numbers(in path: CGPath) -> [CGFloat] {
        var result: [CGFloat] = []
        path.applyWithBlock { element in
            let points = element.pointee.points
            switch element.pointee.type {
            case .moveToPoint, .addLineToPoint:
                result += [points[0].x, points[0].y]
            case .addQuadCurveToPoint:
                result += [points[0].x, points[0].y, points[1].x, points[1].y]
            default:
                break
            }
        }
        return result
    }

    func testSmoothStepMatchesReactFlow() {
        for (index, testCase) in reactFlowCases.enumerated() {
            let route = SmoothStep.route(source: testCase.source, sourceSide: testCase.sourceSide,
                                         target: testCase.target, targetSide: testCase.targetSide)
            let actual = numbers(in: route.cgPath())
            XCTAssertEqual(actual.count, testCase.numbers.count, "case \(index): path shape differs")
            for (a, b) in zip(actual, testCase.numbers) {
                XCTAssertEqual(a, b, accuracy: 0.0001, "case \(index): \(actual) vs \(testCase.numbers)")
            }
            XCTAssertEqual(route.label.x, testCase.label.x, accuracy: 0.0001, "case \(index) label x")
            XCTAssertEqual(route.label.y, testCase.label.y, accuracy: 0.0001, "case \(index) label y")
        }
    }

    /// Positions from NoteNode.tsx's CSS: handles centered 6px outside the
    /// border, 16px boxes on the sides and 10px at the corners, attached at
    /// the middle of the box's outer side.
    func testHandleAnchorsMatchNoteNodeLayout() {
        let note = CGRect(x: 0, y: 0, width: 240, height: 56)
        XCTAssertEqual(NoteHandles.all.count, 40)
        XCTAssertEqual(NoteHandles.handle(id: nil)?.id, "top-left", "React Flow uses the first handle for a null id")
        XCTAssertNil(NoteHandles.handle(id: "nope"))

        XCTAssertEqual(NoteHandles.handle(id: "right-0.5")?.anchor(in: note), CGPoint(x: 254, y: 28))
        XCTAssertEqual(NoteHandles.handle(id: "left-0.5")?.anchor(in: note), CGPoint(x: -14, y: 28))
        XCTAssertEqual(NoteHandles.handle(id: "top-0.1")?.anchor(in: note), CGPoint(x: 24, y: -14))
        XCTAssertEqual(NoteHandles.handle(id: "bottom-0.9")?.anchor(in: note), CGPoint(x: 216, y: 70))
        XCTAssertEqual(NoteHandles.handle(id: "top-left")?.anchor(in: note), CGPoint(x: -6, y: -11))
        XCTAssertEqual(NoteHandles.handle(id: "bottom-right")?.anchor(in: note), CGPoint(x: 246, y: 67))
        XCTAssertEqual(NoteHandles.handle(id: "top-right")?.center(in: note), CGPoint(x: 246, y: -6))
    }

    func testClosestHandleRespectsRadius() {
        let note = CGRect(x: 0, y: 0, width: 240, height: 56)
        XCTAssertEqual(NoteHandles.closest(to: CGPoint(x: 247, y: 30), in: note, within: 20)?.handle.id, "right-0.5")
        XCTAssertNil(NoteHandles.closest(to: CGPoint(x: 400, y: 30), in: note, within: 20))
    }
}
