// In-memory stand-in for a FileSystemFileHandle, as the browser's file picker returns it.
// `disk` is what the file holds: a completed write replaces its text and bumps lastModified.
export function fakeFileHandle(text, { name = "map.yml", permission = "granted" } = {}) {
  const disk = { text, lastModified: 1 };
  const handle = {
    kind: "file",
    name,
    getFile: async () => new File([disk.text], name, { lastModified: disk.lastModified }),
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
