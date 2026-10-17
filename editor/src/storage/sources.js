// Where a story map is read from and written to. The app only uses this interface:
//
//   name                      file name to show
//   writable                  true when write() can save in place
//   version()                 opaque token that changes whenever the stored text changes
//   read()                    { text, version }
//   write(text, expected)     saves text, refusing with WriteConflictError when the stored
//                             version is no longer `expected`; returns the new version
//
// Adding a backend (local server, Git, …) means adding a function here, not changing the app.

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
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
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

/** Source for what the file picker returned: a FileSystemFileHandle or a File. */
export function sourceFor(picked) {
  return typeof picked.getFile === "function" ? fileHandleSource(picked) : fileCopySource(picked);
}
