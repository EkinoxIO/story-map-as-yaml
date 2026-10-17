// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { fakeFileHandle } from "../test/fakeFileHandle.js";
import {
  STORY_MAP_ACCEPT,
  canOpenFilesInPlace,
  fileHandleSource,
  fileCopySource,
  openFileHandle,
  sourceFor,
  WriteConflictError,
} from "./sources.js";

// Browser APIs stubbed by a test are removed after it, even when it fails.
afterEach(() => {
  delete window.showOpenFilePicker;
});

describe("fileHandleSource", () => {
  it("reads the text with its version", async () => {
    const { handle } = fakeFileHandle("title: x\n");
    expect(await fileHandleSource(handle).read()).toEqual({ text: "title: x\n", version: 1 });
  });

  it("writes in place and returns the new version", async () => {
    const { handle, disk } = fakeFileHandle("old");
    expect(await fileHandleSource(handle).write("new", 1)).toBe(2);
    expect(disk.text).toBe("new");
  });

  it("refuses to overwrite a file changed since it was read", async () => {
    const { handle, disk } = fakeFileHandle("old");
    disk.lastModified = 5;
    await expect(fileHandleSource(handle).write("new", 1)).rejects.toThrow(WriteConflictError);
    expect(disk.text).toBe("old");
  });

  it("refuses to write without permission", async () => {
    const { handle, disk } = fakeFileHandle("old", { permission: "denied" });
    await expect(fileHandleSource(handle).write("new", 1)).rejects.toThrow(/not allowed/);
    expect(disk.text).toBe("old");
  });
});

describe("fileCopySource", () => {
  it("reads but cannot write", async () => {
    const source = fileCopySource(new File(["text"], "map.yml", { lastModified: 7 }));
    expect(source.writable).toBe(false);
    expect(await source.read()).toEqual({ text: "text", version: 7 });
    await expect(source.write("x", 7)).rejects.toThrow(/cannot write/);
  });
});

describe("sourceFor", () => {
  it("picks the adapter from what the file picker returned", () => {
    expect(sourceFor(fakeFileHandle("").handle).writable).toBe(true);
    expect(sourceFor(new File([""], "map.yml")).writable).toBe(false);
  });
});

describe("browser capabilities", () => {
  it("follow the File System Access API being there", () => {
    expect(canOpenFilesInPlace()).toBe(false);
    window.showOpenFilePicker = async () => [];
    expect(canOpenFilesInPlace()).toBe(true);
  });
});

describe("file dialogs", () => {
  const cancelled = async () => {
    throw new DOMException("cancelled", "AbortError");
  };

  it("open a chosen file, or nothing when cancelled", async () => {
    const { handle } = fakeFileHandle("");
    window.showOpenFilePicker = async () => [handle];
    expect(await openFileHandle()).toBe(handle);
    window.showOpenFilePicker = cancelled;
    expect(await openFileHandle()).toBeNull();
  });

  it("accept the same extensions in the file input as in the dialogs", () => {
    expect(STORY_MAP_ACCEPT).toBe(".yml,.yaml");
  });
});
