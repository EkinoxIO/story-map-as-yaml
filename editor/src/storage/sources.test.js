import { describe, expect, it } from "vitest";
import { fileHandleSource, fileCopySource, sourceFor, WriteConflictError } from "./sources.js";

// In-memory stand-in for a FileSystemFileHandle.
function fakeHandle(text, { permission = "granted" } = {}) {
  const disk = { text, lastModified: 1 };
  const handle = {
    name: "map.yml",
    getFile: async () => new File([disk.text], "map.yml", { lastModified: disk.lastModified }),
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    createWritable: async () => {
      let buffer = "";
      return {
        write: async (chunk) => {
          buffer += chunk;
        },
        close: async () => {
          disk.text = buffer;
          disk.lastModified += 1;
        },
      };
    },
  };
  return { handle, disk };
}

describe("fileHandleSource", () => {
  it("reads the text with its version", async () => {
    const { handle } = fakeHandle("title: x\n");
    expect(await fileHandleSource(handle).read()).toEqual({ text: "title: x\n", version: 1 });
  });

  it("writes in place and returns the new version", async () => {
    const { handle, disk } = fakeHandle("old");
    expect(await fileHandleSource(handle).write("new", 1)).toBe(2);
    expect(disk.text).toBe("new");
  });

  it("refuses to overwrite a file changed since it was read", async () => {
    const { handle, disk } = fakeHandle("old");
    disk.lastModified = 5;
    await expect(fileHandleSource(handle).write("new", 1)).rejects.toThrow(WriteConflictError);
    expect(disk.text).toBe("old");
  });

  it("refuses to write without permission", async () => {
    const { handle, disk } = fakeHandle("old", { permission: "denied" });
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
    expect(sourceFor(fakeHandle("").handle).writable).toBe(true);
    expect(sourceFor(new File([""], "map.yml")).writable).toBe(false);
  });
});
