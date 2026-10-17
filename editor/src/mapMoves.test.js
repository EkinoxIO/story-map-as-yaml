import { describe, expect, it } from "vitest";
import { UNASSIGNED } from "./mapLayout.js";
import { canDropStories } from "./mapMoves.js";

describe("canDropStories", () => {
  it("only into a cell with a task, outside the Unassigned row and folded activities", () => {
    const column = { task: { id: "task_1" } };
    expect(canDropStories(column, { id: "MVP" })).toBe(true);
    expect(canDropStories(column, UNASSIGNED)).toBe(false);
    expect(canDropStories({ task: null }, { id: "MVP" })).toBe(false);
    expect(canDropStories({ ...column, activityFolded: true }, { id: "MVP" })).toBe(false);
  });
});
