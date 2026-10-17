import { describe, expect, it } from "vitest";
import { ITEM_KIND, applyEdit, parseStoryMap } from "./domain/storyMap.js";
import { UNASSIGNED, buildLayout } from "./mapLayout.js";
import { canDropStories, isMoveKey, keyboardMove } from "./mapMoves.js";

const YAML = `title: "Map"
releases:
  - { id: "MVP", title: "First", goal: "Ship" }
  - { id: "v2", title: "Second", goal: "Grow" }
activities:
  - id: act_1
    title: "Discover"
    tasks:
      - id: task_1
        title: "Search"
        stories:
          - { id: US-1, title: "A", release: "MVP", status: "Done" }
          - { id: US-2, title: "B", release: "MVP", status: "Done" }
      - id: task_2
        title: "Browse"
        stories: []
  - id: act_2
    title: "Buy"
    tasks:
      - id: task_3
        title: "Pay"
        stories:
          - { id: US-3, title: "C", release: "v2", status: "Done" }
`;

// Runs the keyboard move for `item` and returns the resulting plain story map, or null.
function press(key, item, yaml = YAML, folded = new Set()) {
  const doc = parseStoryMap(yaml);
  const layout = buildLayout(doc.toJS(), (foldKey) => folded.has(foldKey));
  const mutate = keyboardMove(layout, item(layout), key);
  return mutate ? applyEdit(doc, mutate).toJS() : null;
}
const ids = (items) => items.map((item) => item.id);
const taskItem = (id) => (layout) => ({
  kind: ITEM_KIND.TASK,
  id,
  column: layout.columns.find((c) => c.task?.id === id),
});
const storyItem = (id, taskId, release) => (layout) => ({
  kind: ITEM_KIND.STORY,
  id,
  column: layout.columns.find((c) => c.task?.id === taskId),
  row: layout.rows.find((r) => r.id === release),
});

describe("isMoveKey", () => {
  it("is Alt plus an arrow key", () => {
    expect(isMoveKey({ altKey: true, key: "ArrowUp" })).toBe(true);
    expect(isMoveKey({ altKey: false, key: "ArrowUp" })).toBe(false);
    expect(isMoveKey({ altKey: true, key: "Enter" })).toBe(false);
  });
});

describe("keyboard moves", () => {
  it("move releases up and down, not past the edges", () => {
    const release = (layout) => ({ kind: ITEM_KIND.RELEASE, id: "v2" });
    expect(ids(press("ArrowUp", release).releases)).toEqual(["v2", "MVP"]);
    expect(press("ArrowDown", release)).toBeNull();
  });

  it("move activities left and right", () => {
    const activity = () => ({ kind: ITEM_KIND.ACTIVITY, id: "act_1" });
    expect(ids(press("ArrowRight", activity).activities)).toEqual(["act_2", "act_1"]);
    expect(press("ArrowLeft", activity)).toBeNull();
  });

  it("move tasks within their activity", () => {
    expect(ids(press("ArrowRight", taskItem("task_1")).activities[0].tasks)).toEqual([
      "task_2",
      "task_1",
    ]);
  });

  it("move a task into the neighbouring activity at its edge", () => {
    const map = press("ArrowRight", taskItem("task_2"));
    expect(ids(map.activities[0].tasks)).toEqual(["task_1"]);
    expect(ids(map.activities[1].tasks)).toEqual(["task_2", "task_3"]);
    expect(press("ArrowLeft", taskItem("task_1"))).toBeNull(); // first task of first activity
  });

  it("skip folded activities when a task moves past the edge of its activity", () => {
    const yaml = YAML.replace(
      "activities:\n",
      'activities:\n  - id: act_0\n    title: "Start"\n    tasks:\n      - { id: task_0, title: "Land", stories: [] }\n',
    );
    // Moving task_3 (first task of act_2) left: act_1 is folded, so it goes to act_0.
    const map = press("ArrowLeft", taskItem("task_3"), yaml, new Set(["activity:act_1"]));
    expect(ids(map.activities[0].tasks)).toEqual(["task_0", "task_3"]);
    expect(ids(map.activities[1].tasks)).toEqual(["task_1", "task_2"]);
    // With every activity on that side folded, the task stays where it is.
    const allFolded = new Set(["activity:act_0", "activity:act_1"]);
    expect(press("ArrowLeft", taskItem("task_3"), yaml, allFolded)).toBeNull();
  });

  it("move stories up and down in their cell", () => {
    const map = press("ArrowDown", storyItem("US-1", "task_1", "MVP"));
    expect(ids(map.activities[0].tasks[0].stories)).toEqual(["US-2", "US-1"]);
  });

  it("move a story into the next release row at the bottom of its cell", () => {
    const map = press("ArrowDown", storyItem("US-2", "task_1", "MVP"));
    expect(map.activities[0].tasks[0].stories.find((s) => s.id === "US-2").release).toBe("v2");
    expect(
      press("ArrowUp", storyItem("US-3", "task_3", "v2")).activities[1].tasks[0].stories[0].release,
    ).toBe("MVP");
  });

  it("skip folded release rows, where the story would vanish from view", () => {
    const yaml = YAML.replace(
      '  - { id: "v2", title: "Second", goal: "Grow" }',
      '  - { id: "v2", title: "Second", goal: "Grow" }\n  - { id: "v3", title: "Third", goal: "Scale" }',
    );
    const folded = new Set(["release:v2"]);
    const map = press("ArrowDown", storyItem("US-2", "task_1", "MVP"), yaml, folded);
    expect(map.activities[0].tasks[0].stories.find((s) => s.id === "US-2").release).toBe("v3");
    // With no visible row left below, the story stays where it is.
    expect(press("ArrowDown", storyItem("US-2", "task_1", "MVP"), YAML, folded)).toBeNull();
  });

  it("move a story left or right into the nearest task, same release", () => {
    const map = press("ArrowRight", storyItem("US-1", "task_1", "MVP"));
    expect(ids(map.activities[0].tasks[1].stories)).toEqual(["US-1"]);
    expect(map.activities[0].tasks[1].stories[0].release).toBe("MVP");
    expect(press("ArrowLeft", storyItem("US-1", "task_1", "MVP"))).toBeNull();
  });

  it("move a story out of the Unassigned row into the last release", () => {
    const yaml = YAML.replace('release: "v2"', 'release: "v9"');
    const item = (layout) => ({
      kind: ITEM_KIND.STORY,
      id: "US-3",
      column: layout.columns.find((c) => c.task?.id === "task_3"),
      row: UNASSIGNED,
    });
    expect(press("ArrowUp", item, yaml).activities[1].tasks[0].stories[0].release).toBe("v2");
    expect(press("ArrowDown", item, yaml)).toBeNull();
  });
});

describe("canDropStories", () => {
  it("only into a cell with a task, outside the Unassigned row and folded activities", () => {
    const column = { task: { id: "task_1" } };
    expect(canDropStories(column, { id: "MVP" })).toBe(true);
    expect(canDropStories(column, UNASSIGNED)).toBe(false);
    expect(canDropStories({ task: null }, { id: "MVP" })).toBe(false);
    expect(canDropStories({ ...column, activityFolded: true }, { id: "MVP" })).toBe(false);
  });
});
