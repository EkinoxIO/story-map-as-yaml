import { useEffect, useRef, useState } from "react";
import { parseStoryMap, serialize, applyEdit, StoryMapError } from "./domain/storyMap.js";
import { saveAsNewFile } from "./storage/sources.js";

const DEFAULT_POLL_INTERVAL_MS = 1000;

function download(name, text) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Loads the story map from `source` (see storage/sources.js), reloads it when it changes,
 * and saves edits back to it. Returns the YAML document, its plain object form, the
 * load/save/move errors to show, and the edit, move and download actions. `pollIntervalMs` is how
 * often a writable source is checked for changes (tests pass a short one).
 */
export default function useStoryMapFile(
  source,
  { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = {},
) {
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [moveError, setMoveError] = useState(null); // about the map on screen: reset on reload
  const [unsaved, setUnsaved] = useState(false); // only for sources that cannot be written
  // Version of the text on screen; null forces the next poll to reload.
  const shownVersion = useRef(null);
  // Saves run one after another, so each one compares against the version the previous one wrote.
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    setDoc(null);
    setLoadError(null);
    setSaveError(null);
    setMoveError(null);
    // A map that only lives in the page (sample, blank) is unsaved until saved or downloaded.
    setUnsaved(Boolean(source?.inMemory));
    if (!source) return;
    let cancelled = false;
    shownVersion.current = null;

    async function refresh() {
      try {
        if ((await source.version()) === shownVersion.current) return;
        const { text, version: loaded } = await source.read();
        shownVersion.current = loaded;
        const next = parseStoryMap(text);
        if (!cancelled) {
          setDoc(next);
          setLoadError(null);
          setMoveError(null);
        }
      } catch (e) {
        // Keep showing the last valid map while the file is mid-edit.
        if (!cancelled) setLoadError(`${source.name}: ${e.message}`);
      }
    }

    refresh();
    // Only sources that can be written are watched: a one-time copy never changes.
    const timer = source.writable ? setInterval(refresh, pollIntervalMs) : null;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [source, pollIntervalMs]);

  async function write(next) {
    try {
      shownVersion.current = await source.write(serialize(next), shownVersion.current);
      setSaveError(null);
    } catch (e) {
      setSaveError(`Not saved: ${e.message}`);
      shownVersion.current = null; // show what is actually stored
    }
  }

  // Applies a domain operation and saves the result. A StoryMapError thrown by the operation
  // propagates synchronously to the caller (the edit dialog), before anything changes.
  function applyAndSave(mutate) {
    const next = applyEdit(doc, mutate);
    if (next === doc) return; // nothing changed, e.g. an item dropped where it was
    setDoc(next);
    if (source.writable) saveQueue.current = saveQueue.current.then(() => write(next));
    else setUnsaved(true);
  }

  // Runs a move (drag and drop, keyboard). One that breaks a rule, e.g. because the item
  // vanished from the file meanwhile, is reported instead of applied.
  function move(mutate) {
    try {
      applyAndSave(mutate);
      setMoveError(null);
    } catch (e) {
      if (!(e instanceof StoryMapError)) throw e;
      setMoveError(`Not moved: ${e.message}`);
    }
  }

  // Saves the map to a new file the user chooses (Chrome, Edge). Resolves to a source for
  // that file, to edit the map there, or to null when cancelled or failed (then saveError).
  async function saveAs() {
    try {
      return await saveAsNewFile(source.name, serialize(doc));
    } catch (e) {
      setSaveError(`Not saved: ${e.message}`);
      return null;
    }
  }

  function downloadCopy() {
    download(source.name, serialize(doc));
    setUnsaved(false);
  }

  return {
    doc,
    storyMap: doc && doc.toJS(),
    loadError,
    saveError,
    moveError,
    unsaved,
    applyAndSave,
    move,
    saveAs,
    downloadCopy,
  };
}
