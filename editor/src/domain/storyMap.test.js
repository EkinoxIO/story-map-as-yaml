import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STATUSES,
  StoryMapError,
  parseStoryMap,
  serialize,
  applyEdit,
  timestamp,
  nextId,
  allStories,
  countStories,
  setMapTitle,
  addRelease,
  updateRelease,
  deleteRelease,
  addActivity,
  renameActivity,
  deleteActivity,
  addTask,
  renameTask,
  deleteTask,
  addStory,
  updateStory,
  deleteStory,
  checkReferences,
  locate,
  itemAt,
  nextStoryId,
  blankStoryMap,
  ITEM_KIND,
  ID_PREFIX,
} from "./storyMap.js";
import schema from "../../../story-map.schema.json" with { type: "json" };

const SAMPLE = readFileSync(new URL("../../../sample_story_map.yml", import.meta.url), "utf8");

const SMALL = `# a comment that must survive
title: "Small"
releases:
  - id: "MVP"
    title: "First"
    goal: "Ship it"
  - id: "v2"
    title: "Second"
    goal: "Grow it"
activities:
  - id: act_1
    title: "Onboarding"
    tasks:
      - id: task_1
        title: "Sign up"
        stories:
          - id: US-1
            title: "Email sign up"
            release: "MVP"
            status: "Done"
      - id: task_2
        title: "Log in"
        stories:
`;

const small = () => parseStoryMap(SMALL);
const js = (doc) => doc.toJS();
const NOW = new Date("2026-10-17T12:34:56.789Z");

describe("vocabulary", () => {
  it("reads statuses from the schema", () => {
    expect(STATUSES).toEqual(["Backlog", "In Progress", "In Review", "Done"]);
  });

  it("generates ids that match the id patterns of the schema", () => {
    const patterns = {
      activity: schema.$defs.activity,
      task: schema.$defs.task,
      story: schema.$defs.story,
    };
    for (const [kind, prefix] of Object.entries(ID_PREFIX)) {
      expect(nextId([], prefix)).toMatch(new RegExp(patterns[kind].properties.id.pattern));
    }
  });
});

describe("locate", () => {
  const storyMap = () => js(small());

  it("finds each kind of item by id", () => {
    expect(locate(storyMap(), ITEM_KIND.RELEASE, "v2")).toEqual({ releaseIndex: 1 });
    expect(locate(storyMap(), ITEM_KIND.ACTIVITY, "act_1")).toEqual({ activityIndex: 0 });
    expect(locate(storyMap(), ITEM_KIND.TASK, "task_2")).toEqual({
      activityIndex: 0,
      taskIndex: 1,
    });
    expect(locate(storyMap(), ITEM_KIND.STORY, "US-1")).toEqual({
      activityIndex: 0,
      taskIndex: 0,
      storyIndex: 0,
    });
  });

  it("returns the item at the indices locate gives, for each kind", () => {
    for (const [kind, id] of [
      [ITEM_KIND.RELEASE, "v2"],
      [ITEM_KIND.ACTIVITY, "act_1"],
      [ITEM_KIND.TASK, "task_2"],
      [ITEM_KIND.STORY, "US-1"],
    ]) {
      expect(itemAt(storyMap(), kind, locate(storyMap(), kind, id)).id).toBe(id);
    }
  });

  it("returns undefined when nothing is at the indices", () => {
    expect(
      itemAt(storyMap(), ITEM_KIND.STORY, { activityIndex: 0, taskIndex: 1, storyIndex: 0 }),
    ).toBeUndefined();
  });

  it("rejects an unknown kind", () => {
    expect(() => itemAt(storyMap(), "map", {})).toThrow(/Unknown item kind/);
  });

  it("returns null for an id that does not exist", () => {
    expect(locate(storyMap(), ITEM_KIND.STORY, "US-99")).toBeNull();
  });
});

describe("parseStoryMap / serialize", () => {
  it("round-trips the sample byte for byte", () => {
    expect(serialize(parseStoryMap(SAMPLE))).toBe(SAMPLE);
  });

  it("rejects invalid YAML", () => {
    expect(() => parseStoryMap("title: [unclosed")).toThrow();
  });

  it("rejects YAML that is not a story map", () => {
    expect(() => parseStoryMap("title: hello\n")).toThrow(StoryMapError);
  });

  it("does not fold long values", () => {
    const doc = small();
    setMapTitle(doc, "x".repeat(200));
    expect(serialize(doc)).toContain(`title: "${"x".repeat(200)}"\n`);
  });
});

describe("blankStoryMap", () => {
  it("is a valid, empty story map that can be filled in", () => {
    const doc = parseStoryMap(blankStoryMap());
    expect(js(doc)).toEqual({ title: "New story map", releases: [], activities: [] });
    expect(checkReferences(js(doc))).toEqual([]);
    addRelease(doc, { id: "MVP", title: "First", goal: "Ship" });
    expect(serialize(doc)).toContain("releases:\n  - id: MVP\n"); // one item per line
  });
});

describe("applyEdit", () => {
  it("returns an edited copy stamped with last_updated and leaves the original alone", () => {
    const doc = small();
    const next = applyEdit(doc, (d) => setMapTitle(d, "Renamed"), NOW);
    expect(js(next).title).toBe("Renamed");
    expect(js(next).last_updated).toBe("2026-10-17T12:34:56Z");
    expect(js(doc).title).toBe("Small");
    expect(js(doc).last_updated).toBeUndefined();
  });

  it("changes only the edited line and last_updated, keeping comments and quotes", () => {
    const before = serialize(parseStoryMap(SAMPLE)).split("\n");
    const after = serialize(
      applyEdit(parseStoryMap(SAMPLE), (d) => setMapTitle(d, "Bookstore"), NOW),
    ).split("\n");
    const changed = after.filter((line, i) => line !== before[i]);
    expect(after).toHaveLength(before.length);
    expect(changed).toEqual(['title: "Bookstore"', 'last_updated: "2026-10-17T12:34:56Z"']);
  });

  it("adds a missing last_updated right after the title, double-quoted", () => {
    const lines = serialize(applyEdit(small(), (d) => setMapTitle(d, "Renamed"), NOW)).split("\n");
    expect(lines.slice(0, 3)).toEqual([
      "# a comment that must survive",
      'title: "Renamed"',
      'last_updated: "2026-10-17T12:34:56Z"',
    ]);
  });

  it("propagates domain errors without returning a document", () => {
    expect(() => applyEdit(small(), (d) => setMapTitle(d, " "))).toThrow(StoryMapError);
  });
});

describe("helpers", () => {
  it("formats timestamps without milliseconds", () => {
    expect(timestamp(NOW)).toBe("2026-10-17T12:34:56Z");
  });

  it("generates the id after the highest one with the prefix", () => {
    expect(nextId(["US-101", "US-107", "US-9"], "US-")).toBe("US-108");
    expect(nextId([], "act_")).toBe("act_1");
    expect(nextId(["task_3", "act_9", "task_x"], "task_")).toBe("task_4");
  });

  it("lists every story with its location", () => {
    const [entry] = allStories(js(small()));
    expect(entry).toMatchObject({
      activityIndex: 0,
      taskIndex: 0,
      storyIndex: 0,
      path: ["activities", 0, "tasks", 0, "stories", 0],
    });
    expect(entry.story.id).toBe("US-1");
    expect(countStories(js(parseStoryMap(SAMPLE)))).toBe(27);
  });
});

describe("releases", () => {
  it("adds a release", () => {
    const doc = small();
    addRelease(doc, { id: "v3", title: "Third", goal: "Scale" });
    expect(js(doc).releases.at(-1)).toEqual({ id: "v3", title: "Third", goal: "Scale" });
  });

  it("refuses a duplicate release id", () => {
    expect(() => addRelease(small(), { id: "MVP", title: "Again", goal: "x" })).toThrow(
      /already exists/,
    );
    expect(() => updateRelease(small(), 1, { id: "MVP", title: "Second", goal: "x" })).toThrow(
      /already exists/,
    );
  });

  it("refuses a release without goal", () => {
    expect(() => addRelease(small(), { id: "v3", title: "Third", goal: "" })).toThrow(
      StoryMapError,
    );
  });

  it("renaming a release id updates the stories that refer to it", () => {
    const doc = small();
    updateRelease(doc, 0, { id: "M1", title: "First", goal: "Ship it" });
    expect(js(doc).releases[0].id).toBe("M1");
    expect(js(doc).activities[0].tasks[0].stories[0].release).toBe("M1");
  });

  it("refuses to delete a release that still has stories", () => {
    expect(() => deleteRelease(small(), 0)).toThrow(/still has 1 story:/);
  });

  it("deletes an empty release", () => {
    const doc = small();
    deleteRelease(doc, 1);
    expect(js(doc).releases.map((r) => r.id)).toEqual(["MVP"]);
  });
});

describe("activities and tasks", () => {
  it("adds an activity with the next id and no tasks", () => {
    const doc = small();
    expect(addActivity(doc, "Checkout")).toBe("act_2");
    expect(js(doc).activities[1]).toEqual({ id: "act_2", title: "Checkout", tasks: [] });
  });

  it("renames and deletes an activity", () => {
    const doc = small();
    renameActivity(doc, 0, "Welcome");
    expect(js(doc).activities[0].title).toBe("Welcome");
    deleteActivity(doc, 0);
    expect(js(doc).activities).toEqual([]);
  });

  it("adds a task with an id unique across activities", () => {
    const doc = small();
    addActivity(doc, "Checkout");
    expect(addTask(doc, 1, "Pay")).toBe("task_3");
    expect(js(doc).activities[1].tasks).toEqual([{ id: "task_3", title: "Pay", stories: [] }]);
  });

  it("renames and deletes a task", () => {
    const doc = small();
    renameTask(doc, 0, 1, "Sign in");
    expect(js(doc).activities[0].tasks[1].title).toBe("Sign in");
    deleteTask(doc, 0, 0);
    expect(js(doc).activities[0].tasks.map((t) => t.id)).toEqual(["task_2"]);
  });

  it("refuses an empty title", () => {
    expect(() => addActivity(small(), "  ")).toThrow(StoryMapError);
    expect(() => renameTask(small(), 0, 0, "")).toThrow(StoryMapError);
  });
});

describe("checkReferences", () => {
  it("finds nothing wrong in the sample", () => {
    expect(checkReferences(js(parseStoryMap(SAMPLE)))).toEqual([]);
  });

  it("reports duplicate ids and unknown releases", () => {
    const broken = SMALL.replace("id: task_2", "id: task_1").replace(
      'release: "MVP"',
      'release: "v9"',
    );
    expect(checkReferences(js(parseStoryMap(broken)))).toEqual([
      'Duplicate task id "task_1" (2 times).',
      'Story US-1 refers to unknown release "v9".',
    ]);
  });
});

describe("stories", () => {
  it("adds a story to a task whose stories list is empty (`stories:`)", () => {
    const doc = small();
    expect(addStory(doc, 0, 1, { title: "Password login", release: "v2" })).toBe("US-2");
    expect(js(doc).activities[0].tasks[1].stories).toEqual([
      { id: "US-2", title: "Password login", release: "v2", status: STATUSES[0] },
    ]);
  });

  it("refuses a story without release", () => {
    expect(() => addStory(small(), 0, 1, { title: "Orphan", release: "" })).toThrow(
      /needs a release/,
    );
  });

  it("updates only the given fields and keeps their quoting", () => {
    const doc = small();
    updateStory(doc, 0, 0, 0, { status: "In Review" });
    expect(js(doc).activities[0].tasks[0].stories[0]).toMatchObject({
      title: "Email sign up",
      status: "In Review",
    });
    expect(serialize(doc)).toContain('status: "In Review"');
  });

  it("refuses to blank a story title", () => {
    expect(() => updateStory(small(), 0, 0, 0, { title: "" })).toThrow(StoryMapError);
  });

  it("deletes a story", () => {
    const doc = small();
    deleteStory(doc, 0, 0, 0);
    expect(countStories(js(doc))).toBe(0);
  });

  it("uses the chosen id for a new story", () => {
    const doc = small();
    expect(addStory(doc, 0, 1, { id: "US-42", title: "Password login", release: "v2" })).toBe(
      "US-42",
    );
    expect(js(doc).activities[0].tasks[1].stories[0].id).toBe("US-42");
  });

  it("suggests the next free id for a new story", () => {
    expect(nextStoryId(js(small()))).toBe("US-2");
  });

  it("refuses a story id that is taken or does not match the schema", () => {
    expect(() => addStory(small(), 0, 1, { id: "US-1", title: "Again", release: "v2" })).toThrow(
      /already exists/,
    );
    expect(() => addStory(small(), 0, 1, { id: "STORY-1", title: "Odd", release: "v2" })).toThrow(
      /not a valid story id/,
    );
    expect(() => addStory(small(), 0, 1, { id: "", title: "Blank", release: "v2" })).toThrow(
      /not a valid story id/,
    );
  });

  it("changes a story id", () => {
    const doc = small();
    updateStory(doc, 0, 0, 0, { id: "US-100", title: "Email sign up" });
    expect(js(doc).activities[0].tasks[0].stories[0].id).toBe("US-100");
  });

  it("accepts saving a story with its own, unchanged id", () => {
    const doc = small();
    updateStory(doc, 0, 0, 0, { id: "US-1", title: "Email sign-up" });
    expect(js(doc).activities[0].tasks[0].stories[0].title).toBe("Email sign-up");
  });

  it("refuses to change a story id to one already used or invalid", () => {
    const doc = small();
    addStory(doc, 0, 1, { title: "Password login", release: "v2" }); // US-2
    expect(() => updateStory(doc, 0, 0, 0, { id: "US-2" })).toThrow(/already exists/);
    expect(() => updateStory(doc, 0, 0, 0, { id: "us-1" })).toThrow(/not a valid story id/);
  });

  it("keeps the leading comment through edits", () => {
    const doc = small();
    addStory(doc, 0, 1, { title: "Password login", release: "v2" });
    expect(serialize(doc).startsWith("# a comment that must survive\n")).toBe(true);
  });
});
