// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyEdit, parseStoryMap, serialize } from "../domain/storyMap.js";
import StoryMap from "./StoryMap.jsx";

afterEach(cleanup);

const YAML = `title: "Bookstore"
releases:
  - { id: "MVP", title: "Walking Skeleton", goal: "Sell one book" }
  - { id: "v2", title: "Returning Customers", goal: "Come back" }
activities:
  - id: act_1
    title: "Discover"
    tasks:
      - id: task_1
        title: "Search"
        stories:
          - { id: US-1, title: "By title", release: "MVP", status: "Done" }
          - { id: US-2, title: "By author", release: "MVP", status: "Backlog" }
      - id: task_2
        title: "Browse"
        stories:
          - { id: US-3, title: "By category", release: "v2", status: "Backlog" }
  - id: act_2
    title: "Buy"
    tasks:
      - id: task_3
        title: "Pay"
        stories:
          - { id: US-4, title: "By card", release: "MVP", status: "Done" }
`;

// Renders the map over a real YAML document; drops apply their move to it, like the app.
function renderMap() {
  let doc = parseStoryMap(YAML);
  const view = render(<StoryMap storyMap={doc.toJS()} onEdit={() => {}} onMove={onMove} />);
  function onMove(mutate) {
    doc = applyEdit(doc, mutate);
    view.rerender(<StoryMap storyMap={doc.toJS()} onEdit={() => {}} onMove={onMove} />);
  }
  return { current: () => doc.toJS(), text: () => serialize(doc), container: view.container };
}

// jsdom has no DragEvent: send mouse events carrying a dataTransfer. Every element measures
// 100x100 at the origin, so a point at 75 is in its second half ("after"), 25 in its first.
const dataTransfer = { setData: () => {}, effectAllowed: "" };
function dragEvent(type, at) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: at, clientY: at });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event;
}
function dragAndDrop(element, target, { after = false } = {}) {
  // The drag starts from the item's own focusable part (its title, or the card itself).
  const source = element.matches("[data-item]") ? element : element.querySelector("[data-item]");
  target.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  const at = after ? 75 : 25;
  fireEvent(source, dragEvent("dragstart", at));
  fireEvent(target, dragEvent("dragover", at));
  fireEvent(target, dragEvent("drop", at));
  fireEvent(source, dragEvent("dragend", at));
}

const card = (id) => screen.getByText(id).closest(".story");
const task = (title) => screen.getByText(title).closest(".task");
const activity = (title) => screen.getByText(title).closest(".activity");
const release = (title) => screen.getByText(title).closest(".release");
const ids = (items) => items.map((item) => item.id);

describe("drag and drop", () => {
  it("reorders releases", () => {
    const map = renderMap();
    dragAndDrop(release("Returning Customers"), release("Walking Skeleton"));
    expect(ids(map.current().releases)).toEqual(["v2", "MVP"]);
  });

  it("reorders activities, dropping after the target", () => {
    const map = renderMap();
    dragAndDrop(activity("Discover"), activity("Buy"), { after: true });
    expect(ids(map.current().activities)).toEqual(["act_2", "act_1"]);
  });

  it("moves a task before a task of another activity", () => {
    const map = renderMap();
    dragAndDrop(task("Browse"), task("Pay"));
    expect(ids(map.current().activities[0].tasks)).toEqual(["task_1"]);
    expect(ids(map.current().activities[1].tasks)).toEqual(["task_2", "task_3"]);
  });

  it("moves a task to the end of an activity dropped on its header", () => {
    const map = renderMap();
    dragAndDrop(task("Search"), activity("Buy"));
    expect(ids(map.current().activities[1].tasks)).toEqual(["task_3", "task_1"]);
  });

  it("reorders stories in a cell", () => {
    const map = renderMap();
    dragAndDrop(card("US-2"), card("US-1"));
    expect(ids(map.current().activities[0].tasks[0].stories)).toEqual(["US-2", "US-1"]);
  });

  it("moves a story to another task and release, changing its release", () => {
    const map = renderMap();
    dragAndDrop(card("US-1"), card("US-3"), { after: true });
    const browse = map.current().activities[0].tasks[1].stories;
    expect(ids(browse)).toEqual(["US-3", "US-1"]);
    expect(browse[1].release).toBe("v2");
  });

  it("moves a story into an empty cell", () => {
    const map = renderMap();
    // The Pay column (third) in the second release row has no story yet.
    const cells = map.container.querySelectorAll(".cell");
    dragAndDrop(card("US-1"), cells[5]);
    const pay = map.current().activities[1].tasks[0].stories;
    expect(ids(pay)).toEqual(["US-4", "US-1"]);
    expect(pay[1].release).toBe("v2");
  });

  it("ignores drops of the wrong kind", () => {
    const map = renderMap();
    const before = map.text();
    dragAndDrop(card("US-1"), release("Returning Customers"));
    dragAndDrop(task("Search"), card("US-4"));
    expect(map.text()).toBe(before);
  });

  it("does not save when an item is dropped where it already is", () => {
    const map = renderMap();
    const before = map.text();
    dragAndDrop(card("US-1"), card("US-2")); // before US-2: where US-1 already is
    expect(map.text()).toBe(before);
  });

  it("highlights the drop position while hovering", () => {
    renderMap();
    const target = release("Walking Skeleton");
    target.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    fireEvent(
      release("Returning Customers").querySelector("[data-item]"),
      dragEvent("dragstart", 25),
    );
    fireEvent(target, dragEvent("dragover", 75));
    expect(target.getAttribute("data-drop")).toBe("after");
  });
});

describe("keyboard moves", () => {
  it("move a focused story with Alt + arrow keys and keep it focused", () => {
    const map = renderMap();
    const us1 = card("US-1");
    us1.focus();
    fireEvent.keyDown(us1, { key: "ArrowDown", altKey: true });
    expect(ids(map.current().activities[0].tasks[0].stories)).toEqual(["US-2", "US-1"]);
    expect(document.activeElement).toBe(card("US-1"));
  });

  it("move a story into another release row and keep the focus on it", () => {
    const map = renderMap();
    fireEvent.keyDown(card("US-2"), { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(card("US-2"), { key: "ArrowDown", altKey: true });
    expect(map.current().activities[0].tasks[0].stories.find((s) => s.id === "US-2").release).toBe(
      "v2",
    );
    expect(document.activeElement).toBe(card("US-2"));
  });

  it("move a release with Alt + arrow keys on its title", () => {
    const map = renderMap();
    fireEvent.keyDown(release("Returning Customers").querySelector("[data-item]"), {
      key: "ArrowUp",
      altKey: true,
    });
    expect(ids(map.current().releases)).toEqual(["v2", "MVP"]);
  });

  it("opens a story with Enter, as a button would", () => {
    const edits = [];
    let doc = parseStoryMap(YAML);
    render(<StoryMap storyMap={doc.toJS()} onEdit={(t) => edits.push(t)} onMove={() => {}} />);
    fireEvent.keyDown(card("US-1"), { key: "Enter" });
    expect(edits).toEqual([expect.objectContaining({ kind: "story", id: "US-1" })]);
  });
});
