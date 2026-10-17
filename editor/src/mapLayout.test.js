import { describe, expect, it } from "vitest";
import { UNASSIGNED, buildLayout, columnWidth } from "./mapLayout.js";

const STORY_MAP = {
  releases: [
    { id: "MVP", title: "First", goal: "Ship" },
    { id: "v2", title: "Second", goal: "Grow" },
  ],
  activities: [
    {
      id: "act_1",
      title: "Discover",
      tasks: [
        { id: "task_1", title: "Search", stories: [{ id: "US-1", release: "MVP" }] },
        {
          id: "task_2",
          title: "Browse",
          stories: [
            { id: "US-2", release: "v2" },
            { id: "US-3", release: "MVP" },
          ],
        },
      ],
    },
    { id: "act_2", title: "Empty", tasks: [] },
  ],
};

describe("buildLayout", () => {
  it("makes one column per task, and one for an activity without tasks", () => {
    const { columns } = buildLayout(STORY_MAP);
    expect(columns.map((c) => c.key)).toEqual(["task_1", "task_2", "1-empty"]);
    expect(columns[2]).toMatchObject({ activityIndex: 1, task: null });
  });

  it("lists the activities with their index and whether they are folded", () => {
    const { activities } = buildLayout(STORY_MAP, (key) => key === "activity:act_2");
    expect(activities.map((a) => [a.id, a.activityIndex, a.folded])).toEqual([
      ["act_1", 0, false],
      ["act_2", 1, true],
    ]);
  });

  it("makes one row per release, with its index", () => {
    const { rows } = buildLayout(STORY_MAP);
    expect(rows.map((r) => [r.id, r.releaseIndex])).toEqual([
      ["MVP", 0],
      ["v2", 1],
    ]);
  });

  it("adds the Unassigned row only when a story needs it", () => {
    const withOrphan = structuredClone(STORY_MAP);
    withOrphan.activities[0].tasks[0].stories.push({ id: "US-9", release: "v9" });
    const { rows, columns, storiesIn } = buildLayout(withOrphan);
    expect(rows.at(-1)).toBe(UNASSIGNED);
    expect(storiesIn(columns[0], UNASSIGNED).map((s) => s.story.id)).toEqual(["US-9"]);
  });

  it("puts each story in the cell of its task and release, in file order", () => {
    const { columns, rows, storiesIn } = buildLayout(STORY_MAP);
    expect(storiesIn(columns[1], rows[0]).map((s) => [s.story.id, s.storyIndex])).toEqual([
      ["US-3", 1],
    ]);
    expect(storiesIn(columns[1], rows[1]).map((s) => s.story.id)).toEqual(["US-2"]);
  });

  it("marks folded tasks and activities, a folded activity overriding its tasks", () => {
    const folded = new Set(["task:task_1"]);
    let layout = buildLayout(STORY_MAP, (key) => folded.has(key));
    expect(layout.columns.map((c) => c.taskFolded)).toEqual([true, false, undefined]);
    folded.add("activity:act_1");
    layout = buildLayout(STORY_MAP, (key) => folded.has(key));
    expect(layout.columns.slice(0, 2).map((c) => [c.activityFolded, c.taskFolded])).toEqual([
      [true, false],
      [true, false],
    ]);
  });
});

describe("columnWidth", () => {
  it("narrows folded columns only", () => {
    expect(columnWidth({ taskFolded: true })).toBe("max-content");
    expect(columnWidth({ activityFolded: true })).toBe("max-content");
    expect(columnWidth({})).toBe("var(--col-width)");
  });
});
