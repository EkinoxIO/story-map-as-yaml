// Where a story map is read from and written to. The app only uses this interface:
//
//   name                      file name to show
//   writable                  true when write() can save in place
//   version()                 opaque token that changes whenever the stored text changes
//   read()                    { text, version }
//   write(text, expected)     saves text, refusing with WriteConflictError when the stored
//                             version is no longer `expected`; returns the new version
//   inMemory                  true when the map only lives in the page (sample, blank) until
//                             it is saved to a file
//
// The browser's file dialogs are wrapped here too (openFileHandle, saveAsNewFile).
// Adding a backend (local server, Git, …) means adding a function here, not changing the app.

// What the browser can do with files. Chromium browsers (Chrome, Edge) implement the File
// System Access API; the others only give a one-time copy of an opened file.

/** Whether opened files can be watched and saved in place (FileSystemFileHandle). */
export function canOpenFilesInPlace() {
  return typeof window.showOpenFilePicker === "function";
}

/** Whether a new file can be created and then edited in place ("Save as…"). */
export function canSaveAsNewFile() {
  return typeof window.showSaveFilePicker === "function";
}

/** The file type offered by the browser's open and save dialogs. */
const STORY_MAP_FILE_TYPES = [
  { description: "Story map", accept: { "text/yaml": [".yml", ".yaml"] } },
];

/** The same file type for an `<input type="file" accept>`: ".yml,.yaml". */
export const STORY_MAP_ACCEPT = STORY_MAP_FILE_TYPES.flatMap((type) =>
  Object.values(type.accept).flat(),
).join(",");

/** The stored file changed since it was read; the message is meant for the user. */
export class WriteConflictError extends Error {
  name = "WriteConflictError";
}

/** A FileSystemFileHandle (Chrome, Edge): read, watched and written in place. */
export function fileHandleSource(handle) {
  const version = async () => (await handle.getFile()).lastModified;
  return {
    name: handle.name,
    writable: true,
    version,
    async read() {
      const file = await handle.getFile();
      return { text: await file.text(), version: file.lastModified };
    },
    async write(text, expectedVersion) {
      const mode = { mode: "readwrite" };
      if (
        (await handle.queryPermission(mode)) !== "granted" &&
        (await handle.requestPermission(mode)) !== "granted"
      ) {
        throw new Error("the browser was not allowed to write to the file.");
      }
      if ((await version()) !== expectedVersion) {
        throw new WriteConflictError(
          "the file changed on disk since it was loaded. It has been reloaded: redo your change.",
        );
      }
      await writeText(handle, text);
      return version();
    },
  };
}

/** A one-time File copy (other browsers): read once, never written. */
export function fileCopySource(file) {
  return {
    name: file.name,
    writable: false,
    version: async () => file.lastModified,
    read: async () => ({ text: await file.text(), version: file.lastModified }),
    async write() {
      throw new Error("this browser cannot write to the file: download it instead.");
    },
  };
}

/**
 * A story map that only lives in the page (the sample, or a blank map) until it is saved to
 * a file: read from `text`, never written.
 */
export function memorySource(name, text) {
  return {
    name,
    writable: false,
    inMemory: true,
    version: async () => 0,
    read: async () => ({ text, version: 0 }),
    async write() {
      throw new Error("this story map is not saved to a file yet.");
    },
  };
}

/** Replaces the whole content of the file behind `handle` with `text`. */
async function writeText(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/**
 * Asks the user for a story map file (Chrome, Edge) and returns its FileSystemFileHandle.
 * Null when the user cancels.
 */
export async function openFileHandle() {
  try {
    const [handle] = await window.showOpenFilePicker({ types: STORY_MAP_FILE_TYPES });
    return handle;
  } catch (e) {
    if (e.name === "AbortError") return null;
    throw e;
  }
}

/**
 * Saves `text` to a new file the user chooses (Chrome, Edge) and returns a source for it, so
 * the map is then edited in that file. Null when the user cancels.
 */
export async function saveAsNewFile(suggestedName, text) {
  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName,
      types: STORY_MAP_FILE_TYPES,
    });
  } catch (e) {
    if (e.name === "AbortError") return null;
    throw e;
  }
  await writeText(handle, text);
  return fileHandleSource(handle);
}

/** Whether the file picker returned a FileSystemFileHandle of a file (not a folder). */
export function isFileHandle(picked) {
  return picked?.kind === "file" && typeof picked.getFile === "function";
}

/** Source for what the file picker returned: a FileSystemFileHandle or a File. */
export function sourceFor(picked) {
  return isFileHandle(picked) ? fileHandleSource(picked) : fileCopySource(picked);
}
