import { useState } from "react";
import {
  STORY_MAP_ACCEPT,
  canOpenFilesInPlace,
  isFileHandle,
  openFileHandle,
} from "../storage/sources.js";

const WATCH_HINT =
  "Live with the file: your edits are saved straight into it, and changes made to it " +
  "elsewhere, by an AI agent or another editor, show up here on their own.";
const COPY_HINT =
  "This browser cannot write to the file: download your edits, and reopen the file " +
  "to see outside changes. Use Chrome or Edge to stay in sync with the file.";
const NOT_A_FILE = "Drop or pick a single YAML file, not a folder.";

// Calls onPick with a FileSystemFileHandle when the file can be watched, a File otherwise.
// Anything else (a folder, an empty drop) is refused with a message; a cancelled choice does
// nothing.
export default function FilePicker({ onPick }) {
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState(null);
  const canOpenInPlace = canOpenFilesInPlace();

  function pick(picked) {
    if (isFileHandle(picked) || picked instanceof File) {
      setProblem(null);
      onPick(picked);
    } else {
      setProblem(NOT_A_FILE);
    }
  }

  async function pickWithHandle() {
    try {
      const handle = await openFileHandle();
      if (handle) pick(handle);
    } catch (e) {
      setProblem(`Could not open the file: ${e.message}`);
    }
  }

  function drop(e) {
    e.preventDefault();
    setDragging(false);
    const item = e.dataTransfer.items[0];
    if (!item || item.kind !== "file") return setProblem(NOT_A_FILE);
    // getAsFileSystemHandle must be called while the drop event is being dispatched.
    if (canOpenInPlace && item.getAsFileSystemHandle) {
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
      {canOpenInPlace ? (
        <button className="primary" onClick={pickWithHandle}>
          Choose file
        </button>
      ) : (
        <input
          type="file"
          accept={STORY_MAP_ACCEPT}
          onChange={(e) => e.target.files[0] && pick(e.target.files[0])}
        />
      )}
      {problem && <p className="problem">{problem}</p>}
      <p>{canOpenInPlace ? WATCH_HINT : COPY_HINT}</p>
    </div>
  );
}
