import { describe, expect, it } from "vitest";
import { applyEdit, parseStoryMap, StoryMapError } from "./domain/storyMap.js";
import { dialogFor, EDIT_KIND } from "./editTargets.js";

const YAML = `title: "Map"
releases:
  - { id: "MVP", title: "First", goal: "Ship" }
  - { id: "v2", title: "Second", goal: "Grow" }
activities:
  - id: act_1
    title: "Onboarding"
    tasks:
      - id: task_1
        title: "Sign up"
        stories:
          - { id: US-1, title: "Email", release: "MVP", status: "Done" }
          - { id: US-2, title: "Google", release: "v2", status: "Backlog" }
  - id: act_2
    title: "Checkout"
    tasks:
      - id: task_2
        title: "Pay"
        stories: []
`;

// Opens the dialog for `target` and returns it with a way to read the document it saved.
function open(target, yaml = YAML) {
  let doc = parseStoryMap(yaml);
  const applyAndSave = (mutate) => {
    doc = applyEdit(doc, mutate);
  };
  const dialog = dialogFor(target, doc.toJS(), applyAndSave);
  return { dialog, saved: () => doc.toJS() };
}

describe("dialogFor", () => {
  it("rejects an unknown kind", () => {
    expect(() => open({ kind: "stroy" })).toThrow(/Unknown edit target kind/);
  });

  it("edits the map title", () => {
    const { dialog, saved } = open({ kind: EDIT_KIND.MAP });
    expect(dialog.initial).toEqual({ title: "Map" });
    dialog.onSave({ title: "Renamed" });
    expect(saved().title).toBe("Renamed");
  });

  it("adds a release and refuses a duplicate id", () => {
    const { dialog, saved } = open({ kind: EDIT_KIND.RELEASE });
    expect(dialog.onDelete).toBeFalsy();
    expect(() => dialog.onSave({ id: "MVP", title: "x", goal: "y" })).toThrow(StoryMapError);
    dialog.onSave({ id: "v3", title: "Third", goal: "Scale" });
    expect(saved().releases.map((r) => r.id)).toEqual(["MVP", "v2", "v3"]);
  });

  it("refuses to delete a release that has stories", () => {
    const { dialog } = open({ kind: EDIT_KIND.RELEASE, releaseIndex: 0, id: "MVP" });
    expect(dialog.deleteConfirmation).toBe('Delete release "First"?');
    expect(() => dialog.onDelete()).toThrow(/still has 1 story/);
  });

  it("describes what deleting an activity removes, then deletes it", () => {
    const { dialog, saved } = open({ kind: EDIT_KIND.ACTIVITY, activityIndex: 0, id: "act_1" });
    expect(dialog.deleteConfirmation).toBe(
      'Delete activity "Onboarding" with its 1 task and 2 stories?',
    );
    dialog.onDelete();
    expect(saved().activities.map((a) => a.id)).toEqual(["act_2"]);
  });

  it("adds a task to the activity it was opened for", () => {
    const { dialog, saved } = open({ kind: EDIT_KIND.TASK, activityIndex: 1, parentId: "act_2" });
    expect(dialog.title).toBe('Add task to "Checkout"');
    dialog.onSave({ title: "Refund" });
    expect(saved().activities[1].tasks.map((t) => t.id)).toEqual(["task_2", "task_3"]);
  });

  it("adds a story preset to the release of the row", () => {
    const target = {
      kind: EDIT_KIND.STORY,
      activityIndex: 1,
      taskIndex: 0,
      parentId: "task_2",
      release: "v2",
    };
    const { dialog, saved } = open(target);
    expect(dialog.initial).toMatchObject({ release: "v2", status: "Backlog" });
    dialog.onSave({ ...dialog.initial, title: "Card" });
    expect(saved().activities[1].tasks[0].stories).toEqual([
      { id: "US-3", title: "Card", release: "v2", status: "Backlog" },
    ]);
  });

  it("keeps an unknown status selectable instead of silently changing it", () => {
    const yaml = YAML.replace('status: "Done"', 'status: "Blocked"');
    const { dialog } = open(
      { kind: EDIT_KIND.STORY, activityIndex: 0, taskIndex: 0, storyIndex: 0, id: "US-1" },
      yaml,
    );
    const status = dialog.fields.find((f) => f.name === "status");
    expect(status.options).toContain("Blocked");
    expect(dialog.initial.status).toBe("Blocked");
  });
});

describe("when the file changed on disk while a dialog is open", () => {
  // Swaps the two stories, as an outside editor reordering the file would.
  const REORDERED = YAML.replace(/( {10}- \{ id: US-1.*\n)( {10}- \{ id: US-2.*\n)/, "$2$1");

  it("edits the story that was clicked, at its new position", () => {
    const target = {
      kind: EDIT_KIND.STORY,
      activityIndex: 0,
      taskIndex: 0,
      storyIndex: 0,
      id: "US-1",
    };
    const { dialog, saved } = open(target, REORDERED);
    expect(dialog.title).toBe("Edit US-1");
    dialog.onSave({ ...dialog.initial, title: "Email (edited)" });
    expect(saved().activities[0].tasks[0].stories.map((s) => s.title)).toEqual([
      "Google",
      "Email (edited)",
    ]);
  });

  it("deletes the story that was clicked, not the one now at its index", () => {
    const target = {
      kind: EDIT_KIND.STORY,
      activityIndex: 0,
      taskIndex: 0,
      storyIndex: 0,
      id: "US-1",
    };
    const { dialog, saved } = open(target, REORDERED);
    dialog.onDelete();
    expect(saved().activities[0].tasks[0].stories.map((s) => s.id)).toEqual(["US-2"]);
  });

  it("adds to the task it was opened for, even if tasks moved", () => {
    const target = {
      kind: EDIT_KIND.STORY,
      activityIndex: 0,
      taskIndex: 0,
      parentId: "task_2",
      release: "MVP",
    };
    const { dialog, saved } = open(target);
    dialog.onSave({ ...dialog.initial, title: "Card" });
    expect(saved().activities[1].tasks[0].stories.map((s) => s.title)).toEqual(["Card"]);
  });

  it("returns no dialog when the item was deleted", () => {
    const yaml = YAML.replace(/ {10}- \{ id: US-1.*\n/, "");
    const target = {
      kind: EDIT_KIND.STORY,
      activityIndex: 0,
      taskIndex: 0,
      storyIndex: 0,
      id: "US-1",
    };
    expect(open(target, yaml).dialog).toBeNull();
  });
});
