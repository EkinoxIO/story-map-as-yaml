#!/usr/bin/env node
// Checks story map files for the rules JSON Schema cannot express (duplicate ids,
// stories referring to an unknown release), using the editor's own domain module.
//
// Usage: node scripts/check-references.js <story_map.yml>...
import { readFileSync } from "node:fs";
import { parseStoryMap, checkReferences } from "../src/domain/storyMap.js";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: check-references.js <story_map.yml>...");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let problems;
  try {
    problems = checkReferences(parseStoryMap(readFileSync(file, "utf8")).toJS());
  } catch (e) {
    problems = [e.message];
  }
  if (problems.length) {
    failed = true;
    console.log(`FAIL ${file}`);
    for (const problem of problems) console.log(`  ${problem}`);
  } else {
    console.log(`ok   ${file}`);
  }
}
process.exit(failed ? 1 : 0);
