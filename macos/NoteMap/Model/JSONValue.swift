import Foundation

/// Arbitrary JSON.
///
/// Exists for exactly one column whose shape this app doesn't own:
/// `nodes.content`, a Tiptap document written by the web app's editor (see
/// `types/canvas.ts`). Decoding it into fixed Swift structs would silently
/// drop anything the web editor adds later, so notes are carried around as
/// raw JSON and only interpreted where needed (`NoteContent`,
/// `TiptapConverter`). Integers and doubles are kept distinct so a value
/// like `"level": 1` survives a round trip as `1`, not `1.0`.
enum JSONValue: Hashable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])
}

extension JSONValue: Codable {
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

extension JSONValue {
    subscript(key: String) -> JSONValue? {
        if case .object(let object) = self { return object[key] }
        return nil
    }

    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var intValue: Int? {
        switch self {
        case .int(let value): return value
        case .double(let value) where value.rounded() == value: return Int(value)
        default: return nil
        }
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var isNull: Bool {
        if case .null = self { return true }
        return false
    }

    /// A Tiptap node's `type`, e.g. `"paragraph"`.
    var nodeType: String? { self["type"]?.stringValue }

    /// A Tiptap node's `content` children (empty when absent).
    var children: [JSONValue] { self["content"]?.arrayValue ?? [] }

    /// A Tiptap node's `attrs` (empty when absent).
    var attrs: [String: JSONValue] { self["attrs"]?.objectValue ?? [:] }

    static func node(_ type: String, attrs: [String: JSONValue]? = nil, content: [JSONValue]? = nil) -> JSONValue {
        var object: [String: JSONValue] = ["type": .string(type)]
        if let attrs { object["attrs"] = .object(attrs) }
        if let content, !content.isEmpty { object["content"] = .array(content) }
        return .object(object)
    }

    func encodedData() throws -> Data {
        try JSONEncoder().encode(self)
    }

    static func decode(_ data: Data) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: data)
    }
}
