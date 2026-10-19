# Development

[Back to the README](../README.md)

## Repository layout

| Path | What it is |
|---|---|
| `story-map.schema.json` | JSON Schema of the story map format |
| `sample_story_map.yml` | Example story map (an online bookstore) |
| `scripts/validate.sh` | Validates story map files: schema, unique ids, known releases |
| `editor/` | Browser editor (React + Vite), built into a single HTML file |
| `site/` | GitHub Pages landing page, favicon, share image (`social-card.svg` → `.png`), editor screenshot (`editor-sample.webp`) and Ekinox logo |
| `docs/` | User and developer documentation |
| `LICENSE`, `NOTICE`, `TRADEMARKS.md` | Apache 2.0 license, copyright notice, and how the Ekinox brand may be used |

## The editor

Node 22+:

```bash
cd editor
npm install
npm run dev    # dev server with hot reload
npm test       # unit tests: domain, storage, edit dialogs, the file hook, components
npm run format # Prettier
npm run build  # regenerate dist/index.html: commit it together with your source changes
```

The build inlines everything into one HTML file on purpose: browsers refuse to load
separate JavaScript module files from a page opened with `file://`. That is also why the
built file is committed: the editor opens from a clone without Node or a build step.

Code layout in `editor/src/`:

- `domain/`: every rule of the format, without React, so it can be tested and reused.
  `storyMap.js` re-exports its parts: `vocabulary.js` (statuses read from
  `story-map.schema.json`, item kinds), `document.js` (parse, serialize, edit),
  `lookups.js`, `operations.js` (add, change, delete), `moves.js`, `checks.js` and `text.js`
  (wording shared by messages). `nodes.js` holds the internal helpers for YAML nodes.
- `storage/sources.js`: where the map is read from and saved to (file handle, read-only copy,
  or a map that only lives in the page), and the browser's open and save dialogs.
- `useStoryMapFile.js`: loading, watching and saving, including *Save as…* for a new map.
- `startingPoints.js`: the bundled sample and the blank map offered by the start screen.
- `editTargets.js`: what each click opens in the edit dialog, and which domain operation
  Save and Delete run.
- `mapLayout.js`: the grid (columns, rows, which stories go in which cell);
  `mapMoves.js`: which move a drop or an Alt + arrow key runs.
- `useMapInteractions.js`: the drag, drop and keyboard props of each part of the map.
- `folding.js`, `useFolding.js` and `useDragAndDrop.js`: fold keys, fold state, and drag state
  with drop targets.
- `components/`: the UI (start screen, file bar, map, edit dialog); `statusColors.js`: the
  card color of each status.

## Continuous integration and publishing

CI (`.github/workflows/ci.yml`) runs the formatting check, the tests, both validations of
[the format](format.md), and fails when the committed `editor/dist` does not match a fresh
build.

GitHub Pages (`.github/workflows/pages.yml`) publishes the site once CI has passed on `main`:
the landing page (`site/index.html`) at <https://ekinoxio.github.io/story-map-as-yaml/>, the
editor at `/editor/`, and the sample and the schema for download. The published site is
public, but it only holds those files, never anyone's story maps.
