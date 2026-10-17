# story-map-as-yaml

Visual editor for YAML story maps, ideal for Spec Driven Development (SDD).

A story map is a YAML file: activities split into tasks, each holding user stories,
sliced horizontally into releases that each have a goal.

## Repository layout

| Path | What it is |
|---|---|
| `story-map.schema.json` | JSON Schema of the story map format |
| `sample_story_map.yml` | Example story map (an online bookstore) |
| `scripts/validate.sh` | Validates story map files: schema, unique ids, known releases |
| `editor/` | Browser editor (React + Vite), built into a single HTML file |

## Editor

Start it either way:

- **Online:** open <https://ekinoxio.github.io/story-map-as-yaml/> (published from `main` by
  `.github/workflows/pages.yml`, once CI has passed). The sample and the schema can be
  downloaded there too: `sample_story_map.yml`, `story-map.schema.json`.
- **From disk:** open `editor/dist/index.html` directly in your browser (no build, no server).
  The built file is committed for that reason.

The editor starts from a story map file on your computer, from the sample, or from a blank
map; a map started from the sample or blank lives in the page until you save it (*Save as…*
in Chrome and Edge, *Download YAML* elsewhere). Files are read and saved on your computer,
never uploaded. The published site is public (GitHub Team plan), but it only holds the
editor and the public sample and schema, never anyone's story maps. *Close* (top right) goes
back to the start screen, asking first if changes are not saved.

- **Chrome / Edge:** every add, edit and delete is saved straight into the YAML file,
  and the map refreshes when the file changes on disk. Comments, quoting and key order
  are kept: only the edited lines and `last_updated` change.
- **Firefox / Safari:** the browser cannot write local files, so use *Download YAML* to save.

A new story gets the next free id (e.g. `US-405`), which you can change; the id of an
existing story can be edited too. Story ids must look like `US-123` (the schema's pattern)
and be unique.

Use the ▾ / ▸ toggles to fold:

- a release: only its title and id stay; its goal and stories are hidden;
- a task: its title stays in a narrow column, and its stories show only their id, so you
  still see how many there are;
- an activity: its title stays over one narrow empty block per task, so you still see how
  many tasks it has; their titles and all their stories are hidden.

Folding only changes the view: nothing is written to the file, and folded items stay folded
when the file reloads.

Drag and drop to reorder, and the file is saved like any other edit:

- releases: up or down;
- activities: left or right;
- tasks: within their activity or into another one (drop on a task, or on an activity's
  title to put the task last);
- stories: within their cell, or into another task and/or release (dropping into another
  release row changes the story's release).

Comments attached to a moved item move with it, and dropping an item where it already is
changes nothing.

From the keyboard, focus an item (Tab) and press **Alt + arrow keys**: releases and stories
move up and down (a story at the edge of its cell goes to the next release row), activities,
tasks and stories move left and right (a task at the edge of its activity goes to the next
activity). Drag and drop was built for Chrome and Edge, and is untested in Firefox and Safari.

Development (Node 22+):

```bash
cd editor
npm install
npm run dev    # dev server with hot reload
npm test       # unit tests: domain, storage, edit dialogs, the file hook, components
npm run format # Prettier
npm run build  # regenerate dist/index.html: commit it together with your source changes
```

The build inlines everything into one HTML file on purpose: browsers refuse to load
separate JavaScript module files from a page opened with `file://`.

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

## Validating a story map

Requires [uv](https://docs.astral.sh/uv/), and Node 22+ with `npm install` done in `editor/`:

```bash
scripts/validate.sh my_story_map.yml
```

It checks the file against the schema, then the rules a schema cannot express (unique ids,
every story's release exists) with the same code the editor uses to show its warnings.

CI (`.github/workflows/ci.yml`) runs the formatting check, the tests, both validations, and
fails when the committed `editor/dist` does not match a fresh build.

Editors using the YAML language server (VS Code, JetBrains) also validate while you type
when the file starts with:

```yaml
# yaml-language-server: $schema=./story-map.schema.json
```

## Contributing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
`<type>(<optional scope>): <description>`, for example `feat(editor): add story drag and drop`
or `fix(domain): keep comments when renaming a release`. Common types are `feat`, `fix`,
`refactor`, `test`, `docs`, `style`, `build`, `ci` and `chore`; scopes used here are
`editor`, `domain`, `schema`, `scripts`, `site`, `ci` and `pages`.
