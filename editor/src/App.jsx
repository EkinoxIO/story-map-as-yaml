import { useEffect, useState } from "react";
import { checkReferences } from "./domain/storyMap.js";
import { memorySource, sourceFor } from "./storage/sources.js";
import { STARTING_POINTS } from "./startingPoints.js";
import useStoryMapFile from "./useStoryMapFile.js";
import { dialogFor, EDIT_KIND } from "./editTargets.js";
import FileBar from "./components/FileBar.jsx";
import StartScreen from "./components/StartScreen.jsx";
import EditDialog from "./components/EditDialog.jsx";
import StoryMap from "./components/StoryMap.jsx";

// `pollIntervalMs` is passed on to useStoryMapFile; tests use a short one.
export default function App({ pollIntervalMs }) {
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(null);
  const {
    doc,
    storyMap: loadedMap,
    loadError,
    saveError,
    moveError,
    unsaved,
    applyAndSave,
    move,
    saveAs,
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
  // would otherwise open it in place of the editor. Drags inside the map carry no files.
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
          <FileBar
            name={source.name}
            lastUpdated={storyMap.last_updated}
            writable={source.writable}
            inMemory={source.inMemory}
            unsaved={unsaved}
            revision={doc}
            onSaveAs={async () => {
              const saved = await saveAs();
              if (saved) setSource(saved);
            }}
            onDownload={downloadCopy}
            onClose={() => setSource(null)}
          />
        )}
      </header>
      <main>
        {saveError && <div className="error">{saveError}</div>}
        {moveError && <div className="error">{moveError}</div>}
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
          <StoryMap storyMap={storyMap} onEdit={setEditing} onMove={move} />
        ) : (
          <StartScreen
            onPick={(picked) => setSource(sourceFor(picked))}
            onStart={(kind) =>
              setSource(memorySource(STARTING_POINTS[kind].name, STARTING_POINTS[kind].text))
            }
          />
        )}
      </main>
      {dialog && (
        <EditDialog key={JSON.stringify(editing)} {...dialog} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
