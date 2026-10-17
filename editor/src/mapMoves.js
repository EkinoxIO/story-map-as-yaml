// Which domain move a drag and drop runs on the map. Each function returns a mutation
// `(doc) => …` for applyAndSave.
// Pure functions over the layout from mapLayout.js: no React, no DOM.
import { ITEM_KIND, moveActivity, moveRelease, moveStory, moveTask } from "./domain/storyMap.js";
import { UNASSIGNED } from "./mapLayout.js";

const ids = (items) => (items || []).map((item) => item.id);
const cellIds = (cellStories) => cellStories.map(({ story }) => story.id);

// The id `offset` places after `id` in `list`, or null past the end.
function idAt(list, id, offset) {
  const index = list.indexOf(id) + offset;
  return index >= 0 && index < list.length ? list[index] : null;
}

// Dropping "after" an item means dropping before the one that follows it.
const beforeIdFor = (list, targetId, after) => (after ? idAt(list, targetId, 1) : targetId);

/** Whether a cell (and the story cards in it) takes stories. */
export function canDropStories(column, row) {
  return column.task?.id != null && row !== UNASSIGNED && !column.activityFolded;
}

/**
 * Drops: the mutation for dropping the item `dragged` ({ kind, id }) on each kind of target.
 * Every one takes (layout, target, dragged, after), `after` being true when the drop lands on
 * the far half of the target; targets that only take items inside them ignore it.
 */
export const drop = {
  release: (layout, release, dragged, after) => (doc) =>
    moveRelease(doc, dragged.id, beforeIdFor(ids(layout.releases), release.id, after)),

  // An activity takes activities (before or after it) and tasks (at its end).
  activity: (layout, activity, dragged, after) => (doc) =>
    dragged.kind === ITEM_KIND.TASK
      ? moveTask(doc, dragged.id, { activityId: activity.id })
      : moveActivity(doc, dragged.id, beforeIdFor(ids(layout.activities), activity.id, after)),

  task: (layout, column, dragged, after) => (doc) => {
    const activity = layout.activities[column.activityIndex];
    return moveTask(doc, dragged.id, {
      activityId: activity.id,
      beforeId: beforeIdFor(ids(activity.tasks), column.task.id, after),
    });
  },

  // "No task yet" under an activity takes tasks into it.
  emptyActivity: (layout, activity, dragged) => (doc) =>
    moveTask(doc, dragged.id, { activityId: activity.id }),

  // A cell is { column, row }; a story card is { column, row, story }.
  cell:
    (layout, { column, row }, dragged) =>
    (doc) =>
      moveStory(doc, dragged.id, { taskId: column.task.id, release: row.id }),

  story:
    (layout, { column, row, story }, dragged, after) =>
    (doc) =>
      moveStory(doc, dragged.id, {
        taskId: column.task.id,
        release: row.id,
        beforeId: beforeIdFor(cellIds(layout.storiesIn(column, row)), story.id, after),
      }),
};
