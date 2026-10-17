// Reading, writing and editing a story map YAML document as a whole.
import { parseDocument, isScalar } from "yaml";
import { StoryMapError } from "./vocabulary.js";

/** Parses YAML text into a Document; throws on YAML errors or when it is not a story map. */
export function parseStoryMap(text) {
  const doc = parseDocument(text);
  if (doc.errors.length) throw doc.errors[0];
  const storyMap = doc.toJS();
  if (!storyMap || !Array.isArray(storyMap.activities)) {
    throw new StoryMapError("This file has no `activities` list: is it a story map?");
  }
  return doc;
}

/** YAML text of a new, empty story map, linked to the schema like the sample. */
export function blankStoryMap(title = "New story map") {
  return [
    "# yaml-language-server: $schema=./story-map.schema.json",
    `title: ${JSON.stringify(title)}`,
    "releases: []",
    "activities: []",
    "",
  ].join("\n");
}

/** YAML text for a Document. lineWidth 0 never folds long values, which keeps diffs small. */
export function serialize(doc) {
  return doc.toString({ lineWidth: 0 });
}

/**
 * Copies `doc`, applies `mutate` to the copy, stamps `last_updated` and returns the copy.
 * `doc` itself is left untouched, so a failed edit leaves nothing half-done. When `mutate`
 * returns false (a move that changes nothing), `doc` itself is returned.
 */
export function applyEdit(doc, mutate, now = new Date()) {
  const next = doc.clone();
  if (mutate(next) === false) return doc;
  stampLastUpdated(next, timestamp(now));
  return next;
}

// Updates last_updated in place, or adds it right after the title when the file has none.
// A new value is double-quoted: YAML 1.1 tools would otherwise read it as a date, not text.
function stampLastUpdated(doc, value) {
  if (doc.has("last_updated")) return doc.set("last_updated", value);
  const pair = doc.createPair("last_updated", value);
  pair.value.type = "QUOTE_DOUBLE";
  const items = doc.contents.items;
  const titleIndex = items.findIndex(({ key }) => (isScalar(key) ? key.value : key) === "title");
  items.splice(titleIndex + 1, 0, pair);
}

/** ISO 8601 timestamp without milliseconds, e.g. "2026-10-17T10:00:00Z". */
export function timestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
