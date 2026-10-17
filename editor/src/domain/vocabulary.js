// The vocabulary of the format: what the schema allows, item kinds and the domain error.
import schema from "../../../story-map.schema.json" with { type: "json" };

const storyProperties = schema.$defs.story.properties;

/** Allowed story statuses, read from the schema so the editor and the validator agree. */
export const STATUSES = storyProperties.status.enum;
/** Prefix of generated ids; must match the id patterns in the schema. */
export const ID_PREFIX = { activity: "act_", task: "task_", story: "US-" };
/** Pattern a story id must match, read from the schema (e.g. "US-101"). */
export const STORY_ID_PATTERN = new RegExp(storyProperties.id.pattern);

/** Kinds of items in a story map, as used by `locate` and `itemAt`. */
export const ITEM_KIND = Object.freeze({
  RELEASE: "release",
  ACTIVITY: "activity",
  TASK: "task",
  STORY: "story",
});

/** A rule of the story map was broken; the message is meant for the user. */
export class StoryMapError extends Error {
  name = "StoryMapError";
}
