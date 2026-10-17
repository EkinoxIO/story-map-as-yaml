// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { statusColor } from "../statusColors.js";
import StoryMap from "./StoryMap.jsx";

afterEach(cleanup);

const STORY_MAP = {
  title: "Bookstore",
  releases: [
    { id: "MVP", title: "Walking Skeleton", goal: "Sell one book" },
    { id: "v2", title: "Returning Customers", goal: "Make them come back" },
  ],
  activities: [
    {
      id: "act_1",
      title: "Discover",
      tasks: [
        {
          id: "task_1",
          title: "Search",
          stories: [{ id: "US-1", title: "Search by title", release: "MVP", status: "Done" }],
        },
        {
          id: "task_2",
          title: "Browse",
          stories: [{ id: "US-2", title: "List by category", release: "v2", status: "Backlog" }],
        },
      ],
    },
    {
      id: "act_2",
      title: "Buy",
      tasks: [
        {
          id: "task_3",
          title: "Pay",
          stories: [{ id: "US-3", title: "Pay by card", release: "MVP", status: "Done" }],
        },
      ],
    },
  ],
};

function renderMap(storyMap = STORY_MAP) {
  const onEdit = vi.fn();
  const view = render(<StoryMap storyMap={storyMap} onEdit={onEdit} />);
  return {
    onEdit,
    container: view.container,
    rerender: (next) => view.rerender(<StoryMap storyMap={next} onEdit={onEdit} />),
  };
}

const fold = (name) => fireEvent.click(screen.getByRole("button", { name: `Fold ${name}` }));
const unfold = (name) => fireEvent.click(screen.getByRole("button", { name: `Unfold ${name}` }));
const shown = (text) => screen.queryByText(text) !== null;
const gridColumns = (container) =>
  container.querySelector(".grid").style.gridTemplateColumns.split(" ");

describe("folding a release", () => {
  it("keeps its title and id, and hides its goal and stories", () => {
    renderMap();
    fold("release Walking Skeleton");
    expect(shown("Walking Skeleton")).toBe(true);
    expect(shown("MVP")).toBe(true);
    expect(shown("Sell one book")).toBe(false);
    expect(shown("Search by title")).toBe(false);
    expect(shown("Pay by card")).toBe(false);
    // Other releases are untouched.
    expect(shown("Make them come back")).toBe(true);
    expect(shown("List by category")).toBe(true);
  });

  it("shows everything again when unfolded", () => {
    renderMap();
    fold("release Walking Skeleton");
    unfold("release Walking Skeleton");
    expect(shown("Sell one book")).toBe(true);
    expect(shown("Search by title")).toBe(true);
  });
});

describe("folding an activity", () => {
  it("keeps its title and one empty block per task, and hides every story", () => {
    const { container } = renderMap();
    fold("activity Discover");
    expect(shown("Discover")).toBe(true);
    // Task titles, fold toggles and stories (even their ids) are hidden.
    for (const hidden of [
      "Search",
      "Browse",
      "Search by title",
      "List by category",
      "US-1",
      "US-2",
    ]) {
      expect(shown(hidden)).toBe(false);
    }
    expect(screen.queryByRole("button", { name: "Fold task Search" })).toBeNull();
    expect(screen.queryAllByTitle("Add task")).toHaveLength(1); // only the other activity's
    // The number of tasks stays visible.
    expect(container.querySelectorAll(".task.placeholder")).toHaveLength(2);
    // Other activities are untouched.
    expect(shown("Pay")).toBe(true);
    expect(shown("Pay by card")).toBe(true);
  });

  it("narrows its columns to their content", () => {
    const { container } = renderMap();
    fold("activity Discover");
    expect(gridColumns(container)).toEqual(["max-content", "max-content", "var(--col-width)"]);
  });

  it("restores its tasks when unfolded", () => {
    renderMap();
    fold("activity Discover");
    unfold("activity Discover");
    expect(shown("Search")).toBe(true);
    expect(shown("List by category")).toBe(true);
  });
});

describe("folding a task", () => {
  it("keeps its title, and shows only the id of its stories", () => {
    renderMap();
    fold("task Search");
    expect(shown("Search")).toBe(true);
    expect(shown("Search by title")).toBe(false);
    const card = screen.getByRole("button", { name: "US-1" });
    expect(card.textContent).toBe("US-1"); // no title or status
    // The status still shows as the card's border color (US-1 is Done).
    expect(card.style.getPropertyValue("--status-color")).toBe(statusColor("Done"));
    // Sibling tasks are untouched.
    expect(shown("List by category")).toBe(true);
  });

  it("hides its + Story buttons and narrows its column", () => {
    const { container } = renderMap();
    const addButtons = screen.getAllByRole("button", { name: "+ Story" }).length;
    fold("task Search");
    expect(screen.getAllByRole("button", { name: "+ Story" })).toHaveLength(addButtons - 2);
    expect(gridColumns(container)).toEqual(["max-content", "var(--col-width)", "var(--col-width)"]);
  });

  it("still opens a story when its id is clicked", () => {
    const { onEdit } = renderMap();
    fold("task Search");
    fireEvent.click(screen.getByRole("button", { name: "US-1" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ kind: "story", id: "US-1" }));
  });
});

describe("fold state", () => {
  it("does not open the edit dialog", () => {
    const { onEdit } = renderMap();
    fold("release Walking Skeleton");
    fold("activity Buy");
    fold("task Search");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("survives a reload of the file that reorders items", () => {
    const { rerender } = renderMap();
    fold("task Search");
    const reordered = structuredClone(STORY_MAP);
    reordered.activities[0].tasks.reverse();
    rerender(reordered);
    expect(shown("Search by title")).toBe(false);
    expect(shown("List by category")).toBe(true);
  });
});
