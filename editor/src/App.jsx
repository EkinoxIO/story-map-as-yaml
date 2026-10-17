import { useEffect, useState } from "react";
import { checkReferences } from "./domain/storyMap.js";
import { sourceFor } from "./storage/sources.js";
import useStoryMapFile from "./useStoryMapFile.js";
import { dialogFor, EDIT_KIND } from "./editTargets.js";
import FilePicker from "./components/FilePicker.jsx";
import EditDialog from "./components/EditDialog.jsx";
import StoryMap from "./components/StoryMap.jsx";

// `pollIntervalMs` is passed on to useStoryMapFile; tests use a short one.
export default function App({ pollIntervalMs }) {
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(null);
  const {
    storyMap: loadedMap,
    loadError,
    saveError,
    unsaved,
    applyAndSave,
    downloadCopy,
  } = useStoryMapFile(source, { pollIntervalMs });
  // The hook drops the previous map only after a render: never show it once its file is closed.
  const storyMap = source ? loadedMap : null;

  const dialog = editing && storyMap && dialogFor(editing, storyMap, applyAndSave);
  // The edited item was deleted on disk while its dialog was open.
  const editedItemGone = Boolean(editing && storyMap && !dialog);
  useEffect(() => {
    if (editedItemGone) setEditing(null);
  }, [editedItemGone]);
  const problems = storyMap ? checkReferences(storyMap) : [];

  // While a map is open, a file dragged in from outside the page is ignored: the browser
  // would otherwise open it in place of the editor.
  const mapOpen = Boolean(storyMap);
  useEffect(() => {
    if (!mapOpen) return;
    const ignoreFiles = (e) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", ignoreFiles);
    window.addEventListener("drop", ignoreFiles);
    return () => {
      window.removeEventListener("dragover", ignoreFiles);
      window.removeEventListener("drop", ignoreFiles);
    };
  }, [mapOpen]);

  return (
    <>
      <header>
        <h1>
          {storyMap ? (
            <button
              className="block"
              title="Edit title"
              onClick={() => setEditing({ kind: EDIT_KIND.MAP })}
            >
              {storyMap.title}
            </button>
          ) : (
            "Story Map Editor"
          )}
        </h1>
        {storyMap && (
          <span className="meta">
            {source.name}
            {storyMap.last_updated && ` · updated ${storyMap.last_updated}`}
            {source.writable
              ? " · saved to file, watching for changes"
              : unsaved && " · unsaved changes"}
          </span>
        )}
        {storyMap && !source.writable && (
          <button className={unsaved ? "primary" : ""} onClick={downloadCopy}>
            Download YAML
          </button>
        )}
        {storyMap && <button onClick={() => setSource(null)}>Open another file</button>}
      </header>
      <main>
        {saveError && <div className="error">{saveError}</div>}
        {loadError && <div className="error">{loadError}</div>}
        {problems.length > 0 && (
          <div className="warning">
            <strong>This story map has inconsistencies:</strong>
            <ul>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        {storyMap ? (
          <StoryMap storyMap={storyMap} onEdit={setEditing} />
        ) : (
          <FilePicker onPick={(picked) => setSource(sourceFor(picked))} />
        )}
      </main>
      {dialog && (
        <EditDialog key={JSON.stringify(editing)} {...dialog} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
