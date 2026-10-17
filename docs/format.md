# The story map format

A story map is a YAML file: activities split into tasks, each holding user stories, sliced
horizontally into releases that each have a goal. [Back to the README](../README.md)

- [`story-map.schema.json`](../story-map.schema.json): the JSON Schema of the format
- [`sample_story_map.yml`](../sample_story_map.yml): an example (an online bookstore)

## Validating a story map

Requires [uv](https://docs.astral.sh/uv/), and Node 22+ with `npm install` done in `editor/`:

```bash
scripts/validate.sh my_story_map.yml
```

It checks the file against the schema, then the rules a schema cannot express (unique ids,
every story's release exists) with the same code the editor uses to show its warnings.

Editors using the YAML language server (VS Code, JetBrains) also validate while you type
when the file starts with:

```yaml
# yaml-language-server: $schema=./story-map.schema.json
```
