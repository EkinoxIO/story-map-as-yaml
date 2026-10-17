// The maps the start screen offers besides opening a file. The sample is bundled into the
// page at build time, so it works offline and from a file opened from disk.
import sampleText from "../../sample_story_map.yml?raw";
import { blankStoryMap } from "./domain/storyMap.js";

export const STARTING_POINTS = {
  sample: { name: "sample_story_map.yml", text: sampleText },
  blank: { name: "story_map.yml", text: blankStoryMap() },
};
