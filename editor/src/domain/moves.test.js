import { describe, expect, it } from "vitest";
import {
  StoryMapError,
  applyEdit,
  addStory,
  moveActivity,
  moveRelease,
  moveStory,
  moveTask,
  parseStoryMap,
  serialize,
} from "./storyMap.js";

const YAML = `title: "Moves"
releases:
  - id: "MVP"
    title: "First"
    goal: "Ship"
  - id: "v2"
    title: "Second"
    goal: "Grow"
  - id: "v3"
    title: "Third"
    goal: "Scale"
activities:
  - id: act_1
    title: "Discover"
    tasks:
      - id: task_1
        title: "Search"
        stories:
          # first search story
          - id: US-1
            title: "By title"
            release: "MVP"
            status: "Done"
          - id: US-2
            title: "By author"
            release: "MVP"
            status: "Backlog"
          - id: US-3
            title: "Autocomplete"
            release: "v2"
            status: "Backlog"
      - id: task_2
        title: "Browse"
        stories: []
  - id: act_2
    title: "Buy"
    tasks:
      - id: task_3
        title: "Pay"
        stories:
          - id: US-4
            title: "Card"
            release: "MVP"
            status: "Done"
`;

const load = () => parseStoryMap(YAML);
const ids = (items) => items.map((item) => item.id);
const releases = (doc) => ids(doc.toJS().releases);
const activities = (doc) => ids(doc.toJS().activities);
const tasks = (doc, a) => ids(doc.toJS().activities[a].tasks);
const stories = (doc, a, t) => ids(doc.toJS().activities[a].tasks[t].stories);

describe("moveRelease", () => {
  it("moves a release before another one", () => {
    const doc = load();
    moveRelease(doc, "v3", "MVP");
    expect(releases(doc)).toEqual(["v3", "MVP", "v2"]);
  });

  it("moves a release to the end", () => {
    const doc = load();
    moveRelease(doc, "MVP", null);
    expect(releases(doc)).toEqual(["v2", "v3", "MVP"]);
  });

  it("does nothing when dropped on itself", () => {
    const doc = load();
    moveRelease(doc, "v2", "v2");
    expect(serialize(doc)).toBe(YAML);
  });
});

describe("moveActivity", () => {
  it("moves an activity with its tasks and stories", () => {
    const doc = load();
    moveActivity(doc, "act_2", "act_1");
    expect(activities(doc)).toEqual(["act_2", "act_1"]);
    expect(stories(doc, 0, 0)).toEqual(["US-4"]);
  });
});

describe("moveTask", () => {
  it("reorders tasks inside an activity", () => {
    const doc = load();
    moveTask(doc, "task_2", { activityId: "act_1", beforeId: "task_1" });
    expect(tasks(doc, 0)).toEqual(["task_2", "task_1"]);
  });

  it("moves a task, with its stories, to another activity", () => {
    const doc = load();
    moveTask(doc, "task_1", { activityId: "act_2" });
    expect(tasks(doc, 0)).toEqual(["task_2"]);
    expect(tasks(doc, 1)).toEqual(["task_3", "task_1"]);
    expect(stories(doc, 1, 1)).toEqual(["US-1", "US-2", "US-3"]);
  });

  it("can empty an activity", () => {
    const doc = load();
    moveTask(doc, "task_3", { activityId: "act_1", beforeId: "task_2" });
    expect(tasks(doc, 0)).toEqual(["task_1", "task_3", "task_2"]);
    expect(doc.toJS().activities[1].tasks).toEqual([]);
  });
});

describe("moveStory", () => {
  it("reorders stories inside a task and release", () => {
    const doc = load();
    moveStory(doc, "US-2", { taskId: "task_1", release: "MVP", beforeId: "US-1" });
    expect(stories(doc, 0, 0)).toEqual(["US-2", "US-1", "US-3"]);
  });

  it("moves a story to another task, after that task's stories of the same release", () => {
    const doc = load();
    moveStory(doc, "US-4", { taskId: "task_1", release: "MVP" });
    expect(stories(doc, 0, 0)).toEqual(["US-1", "US-2", "US-4", "US-3"]);
    expect(doc.toJS().activities[1].tasks[0].stories).toEqual([]);
  });

  it("moves a story to another release, changing its release", () => {
    const doc = load();
    moveStory(doc, "US-1", { taskId: "task_1", release: "v2" });
    expect(stories(doc, 0, 0)).toEqual(["US-2", "US-3", "US-1"]);
    const moved = doc.toJS().activities[0].tasks[0].stories[2];
    expect(moved.release).toBe("v2");
    expect(serialize(doc)).toContain('release: "v2"'); // keeps the quoting
  });

  it("moves a story into an empty task written as `stories: []`, one item per line", () => {
    const doc = load();
    moveStory(doc, "US-3", { taskId: "task_2", release: "v2" });
    expect(stories(doc, 0, 1)).toEqual(["US-3"]);
    expect(serialize(doc)).toContain(
      '        title: "Browse"\n        stories:\n          - id: US-3\n',
    );
  });

  it("keeps the comment attached to a moved story", () => {
    const doc = load();
    moveStory(doc, "US-1", { taskId: "task_3", release: "MVP" });
    expect(serialize(doc)).toMatch(/# first search story\n\s+- id: US-1/);
    expect(stories(doc, 1, 0)).toEqual(["US-4", "US-1"]);
  });

  it("refuses unknown ids and releases", () => {
    expect(() => moveStory(load(), "US-99", { taskId: "task_1" })).toThrow(StoryMapError);
    expect(() => moveStory(load(), "US-1", { taskId: "task_99" })).toThrow(StoryMapError);
    expect(() => moveStory(load(), "US-1", { taskId: "task_1", release: "v9" })).toThrow(
      /no release/,
    );
  });
});

describe("adding to an empty `stories: []`", () => {
  it("writes the new story on its own lines", () => {
    const doc = load();
    addStory(doc, 0, 1, { title: "By category", release: "MVP" });
    expect(serialize(doc)).toContain("        stories:\n          - id: US-5\n");
  });
});

describe("comments around moved items", () => {
  it("keeps the comment of the story that becomes first in its list", () => {
    const doc = load();
    moveStory(doc, "US-3", { taskId: "task_1", release: "v2", beforeId: "US-1" });
    expect(serialize(doc)).toMatch(/- id: US-3[\s\S]*# first search story\n\s+- id: US-1/);
  });
});

describe("moves that change nothing", () => {
  it("report it, so no save happens", () => {
    expect(moveRelease(load(), "v2", "v2")).toBe(false);
    expect(moveRelease(load(), "MVP", "v2")).toBe(false); // already right before v2
    expect(moveActivity(load(), "act_2", null)).toBe(false); // already last
    expect(moveTask(load(), "task_1", { activityId: "act_1", beforeId: "task_2" })).toBe(false);
    expect(moveStory(load(), "US-2", { taskId: "task_1", release: "MVP" })).toBe(false);
  });

  it("report real moves", () => {
    expect(moveRelease(load(), "v2", null)).toBe(true);
    expect(moveStory(load(), "US-2", { taskId: "task_1", release: "v2" })).toBe(true);
  });

  it("leave the document untouched in applyEdit", () => {
    const doc = load();
    expect(applyEdit(doc, (d) => moveRelease(d, "MVP", "v2"))).toBe(doc);
  });
});
