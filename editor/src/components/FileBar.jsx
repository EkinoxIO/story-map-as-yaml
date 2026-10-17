import { useEffect, useState } from "react";
import { canSaveAsNewFile } from "../storage/sources.js";

// The file part of the header: which file, whether it is saved, and the file actions.
// `revision` changes whenever the map changes (the document itself will do).
// Close asks first when changes are not saved. That confirmation disarms as soon as the map
// changes, is saved, or the button loses focus, so it never applies to changes made later.
export default function FileBar({
  name,
  lastUpdated,
  writable,
  inMemory,
  unsaved,
  revision,
  onSaveAs,
  onDownload,
  onClose,
}) {
  const [confirmingClose, setConfirmingClose] = useState(false);
  useEffect(() => {
    setConfirmingClose(false);
  }, [revision, unsaved]);

  function close() {
    if (unsaved && !confirmingClose) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  }

  const status = writable
    ? "saved to file, watching for changes"
    : inMemory && unsaved
      ? "not saved to a file yet"
      : unsaved
        ? "unsaved changes"
        : null;
  const offerSaveAs = inMemory && canSaveAsNewFile();

  return (
    <>
      <span className="meta">
        {name}
        {lastUpdated && ` · updated ${lastUpdated}`}
        {status && ` · ${status}`}
      </span>
      {offerSaveAs && (
        <button className="primary" onClick={onSaveAs}>
          Save as…
        </button>
      )}
      {!writable && !offerSaveAs && (
        <button className={unsaved ? "primary" : ""} onClick={onDownload}>
          Download YAML
        </button>
      )}
      <button
        className={confirmingClose ? "danger" : ""}
        title="Close this story map and go back to the start screen"
        onClick={close}
        onBlur={() => setConfirmingClose(false)}
      >
        {confirmingClose ? "Discard unsaved changes?" : "Close"}
      </button>
    </>
  );
}
