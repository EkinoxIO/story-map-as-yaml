// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { moveRelease, setMapTitle, StoryMapError } from "./domain/storyMap.js";
import { WriteConflictError } from "./storage/sources.js";
import useStoryMapFile from "./useStoryMapFile.js";

// Poll fast so tests that wait for a reload do not depend on wall-clock margins.
const options = { pollIntervalMs: 20 };

const YAML = `title: "Map"
releases: []
activities: []
`;

// In-memory source following the storage/sources.js interface. `holdWrites()` makes writes
// wait until `releaseWrites()`, to simulate a slow save (e.g. a permission prompt).
function memorySource(text, { writable = true } = {}) {
  const stored = { text, version: 1 };
  let gate = null;
  const source = {
    name: "map.yml",
    writable,
    stored,
    writes: 0,
    version: async () => stored.version,
    read: async () => ({ text: stored.text, version: stored.version }),
    async write(next, expectedVersion) {
      if (gate) await gate.promise;
      if (stored.version !== expectedVersion) throw new WriteConflictError("changed on disk");
      stored.text = next;
      stored.version += 1;
      source.writes += 1;
      return stored.version;
    },
    holdWrites() {
      let release;
      gate = { promise: new Promise((resolve) => (release = resolve)) };
      gate.release = release;
    },
    releaseWrites() {
      gate.release();
      gate = null;
    },
    changeOnDisk(newText) {
      stored.text = newText;
      stored.version += 10;
    },
  };
  return source;
}

async function load(source) {
  const hook = renderHook(() => useStoryMapFile(source, options));
  await waitFor(() => expect(hook.result.current.storyMap).not.toBeNull());
  return hook;
}

const rename = (title) => (doc) => setMapTitle(doc, title);

describe("useStoryMapFile", () => {
  it("loads the story map from the source", async () => {
    const { result } = await load(memorySource(YAML));
    expect(result.current.storyMap.title).toBe("Map");
    expect(result.current.loadError).toBeNull();
  });

  it("reports a file that is not a story map", async () => {
    const { result } = renderHook(() => useStoryMapFile(memorySource("title: x\n"), options));
    await waitFor(() => expect(result.current.loadError).toMatch(/is it a story map/));
  });

  it("reloads when the stored file changes", async () => {
    const source = memorySource(YAML);
    const { result } = await load(source);
    source.changeOnDisk(YAML.replace('"Map"', '"Changed"'));
    await waitFor(() => expect(result.current.storyMap.title).toBe("Changed"));
  });

  it("keeps the last valid map while the file is invalid", async () => {
    const source = memorySource(YAML);
    const { result } = await load(source);
    source.changeOnDisk("title: [unclosed");
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.storyMap.title).toBe("Map");
  });

  it("saves an edit to the source", async () => {
    const source = memorySource(YAML);
    const { result } = await load(source);
    act(() => result.current.applyAndSave(rename("Saved")));
    expect(result.current.storyMap.title).toBe("Saved");
    await waitFor(() => expect(source.writes).toBe(1));
    expect(source.stored.text).toContain('title: "Saved"');
    expect(result.current.saveError).toBeNull();
  });

  it("refuses a rule violation before anything is written", async () => {
    const source = memorySource(YAML);
    const { result } = await load(source);
    expect(() => result.current.applyAndSave(rename(""))).toThrow(StoryMapError);
    expect(result.current.storyMap.title).toBe("Map");
    expect(source.writes).toBe(0);
  });

  it("does not overwrite a file changed on disk since it was loaded", async () => {
    const source = memorySource(YAML);
    const { result } = await load(source);
    source.changeOnDisk(YAML.replace('"Map"', '"Outside"'));
    act(() => result.current.applyAndSave(rename("Mine")));
    await waitFor(() => expect(result.current.saveError).toMatch(/Not saved: changed on disk/));
    expect(source.stored.text).toContain('"Outside"');
    await waitFor(() => expect(result.current.storyMap.title).toBe("Outside"));
  });

  it("saves two quick edits in order while the first save is still pending", async () => {
    const source = memorySource(YAML);
    const { result } = await load(source);
    source.holdWrites();
    act(() => result.current.applyAndSave(rename("First")));
    act(() => result.current.applyAndSave(rename("Second")));
    source.releaseWrites();
    await waitFor(() => expect(source.writes).toBe(2));
    expect(source.stored.text).toContain('title: "Second"');
    expect(result.current.saveError).toBeNull();
  });

  it("reports a move that breaks a rule, and forgets it when the file reloads", async () => {
    const source = memorySource(YAML);
    const { result } = await load(source);
    act(() => result.current.move((doc) => moveRelease(doc, "nope", null)));
    expect(result.current.moveError).toMatch(/Not moved: There is no release/);
    expect(source.writes).toBe(0);
    source.changeOnDisk(YAML.replace('"Map"', '"Reloaded"'));
    await waitFor(() => expect(result.current.storyMap.title).toBe("Reloaded"));
    expect(result.current.moveError).toBeNull();
  });

  it("forgets a move error when another file is opened", async () => {
    let source = memorySource(YAML);
    const { result, rerender } = renderHook(() => useStoryMapFile(source, options));
    await waitFor(() => expect(result.current.storyMap).not.toBeNull());
    act(() => result.current.move((doc) => moveRelease(doc, "nope", null)));
    expect(result.current.moveError).not.toBeNull();
    source = memorySource(YAML.replace('"Map"', '"Other"'));
    rerender();
    await waitFor(() => expect(result.current.storyMap?.title).toBe("Other"));
    expect(result.current.moveError).toBeNull();
  });

  it("only marks edits as unsaved when the source cannot be written", async () => {
    const source = memorySource(YAML, { writable: false });
    const { result } = await load(source);
    act(() => result.current.applyAndSave(rename("Local")));
    expect(result.current.unsaved).toBe(true);
    expect(source.writes).toBe(0);
  });
});
