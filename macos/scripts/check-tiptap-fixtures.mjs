// Checks that the Tiptap JSON fixtures in the Swift tests are exactly what
// the web app's own editor schema (lib/editor/extensions.ts) produces, so
// the round-trip tests compare against real Tiptap output.
//
// Run from the repository root (Node 22.6+):
//   node --experimental-strip-types --no-warnings macos/scripts/check-tiptap-fixtures.mjs
//
// Expected, not a problem: fixtures built the way `lib/editor/content.ts`
// builds notes (a title paragraph with no `attrs`, an image with only
// `src`) differ from what a live editor would emit, and a fixture holding
// node types outside the schema differs once those are stripped.
import { readFileSync } from "node:fs";
import { getSchema } from "@tiptap/core";
import { getNoteExtensions } from "../../lib/editor/extensions.ts";

const schema = getSchema(getNoteExtensions());
const testsDir = new URL("../NoteMapTests/", import.meta.url);
const source = ["TiptapConverterTests.swift", "EditorControllerTests.swift"]
  .map((file) => readFileSync(new URL(file, testsDir), "utf8"))
  .join("\n");
const fixtures = [...source.matchAll(/#"""\n([\s\S]*?)\n\s*"""#|#"(\{"type":"doc"[\s\S]*?\})"#/g)].map((m) => m[1] ?? m[2]);

// Node types outside the schema are there to test pass-through; drop them.
const strip = (node) => {
  if (Array.isArray(node)) return node.map(strip);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [
    key,
    key === "content" ? value.filter((child) => schema.nodes[child.type]).map(strip) : strip(value),
  ]));
};
const sorted = (value) => Array.isArray(value) ? value.map(sorted)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
    : value;

for (const [index, raw] of fixtures.entries()) {
  const doc = strip(JSON.parse(raw));
  const canonical = schema.nodeFromJSON(doc).toJSON();
  const same = JSON.stringify(sorted(canonical)) === JSON.stringify(sorted(doc));
  console.log(same
    ? `fixture ${index}: canonical`
    : `fixture ${index}: differs\n  fixture: ${JSON.stringify(doc)}\n  tiptap:  ${JSON.stringify(canonical)}`);
}
