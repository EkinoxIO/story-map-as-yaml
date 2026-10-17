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

Open `editor/dist/index.html` directly in your browser (no build, no server) and pick a story
map file: it is read and saved on your computer, never uploaded. The built file is committed
for that reason.

- **Chrome / Edge:** every add, edit and delete is saved straight into the YAML file,
  and the map refreshes when the file changes on disk. Comments, quoting and key order
  are kept: only the edited lines and `last_updated` change.
- **Firefox / Safari:** the browser cannot write local files, so use *Download YAML* to save.

Use the ▾ / ▸ toggles to fold:

- a release: only its title and id stay; its goal and stories are hidden;
- a task: its title stays in a narrow column, and its stories show only their id, so you
  still see how many there are;
- an activity: its title stays over one narrow empty block per task, so you still see how
  many tasks it has; their titles and all their stories are hidden.

Folding only changes the view: nothing is written to the file, and folded items stay folded
when the file reloads.

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
- `storage/sources.js`: where the map is read from and saved to (file handle, or a read-only
  copy), and the browser's open dialog.
- `useStoryMapFile.js`: loading, watching and saving.
- `editTargets.js`: what each click opens in the edit dialog, and which domain operation
  Save and Delete run.
- `mapLayout.js`: the grid (columns, rows, which stories go in which cell).
- `folding.js` and `useFolding.js`: fold keys and fold state.
- `components/`: the UI (file picker, map, edit dialog); `statusColors.js`: the card color
  of each status.

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
