import { useState } from "react";

// Chromium browsers can hand out a live, writable handle on a local file;
// other browsers only give a one-time copy.
const canWatchFiles = typeof window.showOpenFilePicker === "function";

const WATCH_HINT =
  "Edits are saved to the file, and the map refreshes whenever the file changes on disk.";
const COPY_HINT =
  "This browser cannot write to the file: download your edits, and reopen the file " +
  "to see outside changes. Use Chrome or Edge for live editing.";
const NOT_A_FILE = "Drop or pick a single YAML file, not a folder.";

// Calls onPick with a FileSystemFileHandle when the file can be watched, a File otherwise.
// Anything else (a folder, an empty drop, a cancelled choice) is refused with a message.
export default function FilePicker({ onPick }) {
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState(null);

  function pick(picked) {
    const isFileHandle = picked?.kind === "file" && typeof picked.getFile === "function";
    if (isFileHandle || picked instanceof File) {
      setProblem(null);
      onPick(picked);
    } else {
      setProblem(NOT_A_FILE);
    }
  }

  async function pickWithHandle() {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "Story map", accept: { "text/yaml": [".yml", ".yaml"] } }],
      });
      pick(handle);
    } catch (e) {
      if (e.name !== "AbortError") setProblem(`Could not open the file: ${e.message}`);
    }
  }

  function drop(e) {
    e.preventDefault();
    setDragging(false);
    const item = e.dataTransfer.items[0];
    if (!item || item.kind !== "file") return setProblem(NOT_A_FILE);
    // getAsFileSystemHandle must be called while the drop event is being dispatched.
    if (canWatchFiles && item.getAsFileSystemHandle) {
      item
        .getAsFileSystemHandle()
        .then(pick)
        .catch((error) => setProblem(`Could not open the file: ${error.message}`));
    } else {
      pick(item.getAsFile());
    }
  }

  return (
    <div
      className={"dropzone" + (dragging ? " dragging" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <h2>Open a story map</h2>
      <p>Drop a YAML file here, or pick one.</p>
      {canWatchFiles ? (
        <button onClick={pickWithHandle}>Choose file</button>
      ) : (
        <input
          type="file"
          accept=".yml,.yaml"
          onChange={(e) => e.target.files[0] && pick(e.target.files[0])}
        />
      )}
      {problem && <p className="problem">{problem}</p>}
      <p>{canWatchFiles ? WATCH_HINT : COPY_HINT}</p>
    </div>
  );
}
