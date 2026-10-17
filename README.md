# Story Map as YAML

A visual editor for user story maps whose source of truth is a plain YAML file, built for
Spec-Driven Development (SDD): AI agents read and change the file like any other file in the
repository, and people see and shape it as a map.

- **Website:** <https://ekinoxio.github.io/story-map-as-yaml/>
- **Open the editor:** <https://ekinoxio.github.io/story-map-as-yaml/editor/>, or
  `editor/dist/index.html` straight from disk (no install, no build)
- **Format:** [`story-map.schema.json`](story-map.schema.json), with an
  [example](sample_story_map.yml) (an online bookstore)

A story map is a YAML file: activities split into tasks, each holding user stories, sliced
horizontally into releases that each have a goal.

## Live with your file

In Chrome and Edge, the editor works on the file itself, both ways:

- **Changes made to the file elsewhere show up on their own.** When an AI agent, another
  editor or a `git pull` changes the file, the map updates within a second, with no reload.
- **Changes made in the editor are saved straight into the file**, keeping its comments,
  quoting and key order: only the edited lines and `last_updated` change.

Firefox and Safari can only open a copy of the file: download your edits to save them, and
open the file again to see changes made elsewhere. Files stay on your computer either way:
nothing is uploaded.

## Documentation

- [Using the editor](docs/editor.md): starting a map, editing, folding, reordering
- [The format and its validation](docs/format.md): schema, `scripts/validate.sh`
- [Development](docs/development.md): repository and code layout, tests, build, CI
- [Contributing](CONTRIBUTING.md)

## License

The code is licensed under the [Apache License 2.0](LICENSE): you may use, change and
redistribute it, keeping the notices in [LICENSE](LICENSE) and [NOTICE](NOTICE). The Ekinox
name and logo are trademarks of Ekinox and are not covered by that license: see
[TRADEMARKS.md](TRADEMARKS.md).
