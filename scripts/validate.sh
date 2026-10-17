#!/usr/bin/env bash
# Validate story map YAML files: first against story-map.schema.json, then for the rules
# JSON Schema cannot express (unique ids, story releases that exist), using the editor's
# domain module so both tools apply the same rules.
#
# Usage: scripts/validate.sh [story_map.yml ...]   (defaults to sample_story_map.yml)
# Requires: uv (https://docs.astral.sh/uv/), Node 22+ and `npm install` in editor/
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -eq 0 ]; then
  set -- "$repo_root/sample_story_map.yml"
fi

if [ ! -d "$repo_root/editor/node_modules" ]; then
  echo "error: run 'npm install' in editor/ first" >&2
  exit 2
fi

uvx check-jsonschema==0.38.2 --schemafile "$repo_root/story-map.schema.json" "$@"
node "$repo_root/editor/scripts/check-references.js" "$@"
