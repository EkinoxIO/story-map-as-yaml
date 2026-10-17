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
  const { storyMap, loadError, saveError, unsaved, applyAndSave, downloadCopy } = useStoryMapFile(
    source,
    { pollIntervalMs },
  );

  const dialog = editing && storyMap && dialogFor(editing, storyMap, applyAndSave);
  // The edited item was deleted on disk while its dialog was open.
  const editedItemGone = Boolean(editing && storyMap && !dialog);
  useEffect(() => {
    if (editedItemGone) setEditing(null);
  }, [editedItemGone]);
  const problems = storyMap ? checkReferences(storyMap) : [];

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
