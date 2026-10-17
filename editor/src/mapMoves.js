// Which domain move a drag and drop or a keyboard shortcut runs on the map. Each function
// returns a mutation `(doc) => …` for applyAndSave, or null when there is nothing to do.
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

const UP = "ArrowUp";
const DOWN = "ArrowDown";
const LEFT = "ArrowLeft";
const RIGHT = "ArrowRight";

/** Whether a key event is a keyboard move: Alt plus an arrow key. */
export function isMoveKey(event) {
  return event.altKey && [UP, DOWN, LEFT, RIGHT].includes(event.key);
}

// One step before or after in an ordered list: before the previous item, or before the one
// after the next. Null at the edges.
function stepMutation(list, id, key, back, forward, move) {
  if (key === back) {
    const previous = idAt(list, id, -1);
    return previous && ((doc) => move(doc, id, previous));
  }
  if (key === forward) {
    if (idAt(list, id, 1) == null) return null;
    return (doc) => move(doc, id, idAt(list, id, 2));
  }
  return null;
}

/**
 * Keyboard moves (Alt + arrow on a focused item), using the same domain moves as drag and
 * drop. `item` is { kind, id } plus, for a task, its column and, for a story, its column
 * and row.
 * - releases: up and down; activities: left and right
 * - tasks: left and right, into the neighbouring activity at its edges
 * - stories: up and down in their cell, into the neighbouring release row at its edges;
 *   left and right into the neighbouring task, same release
 */
export function keyboardMove(layout, item, key) {
  if (item.kind === ITEM_KIND.RELEASE) {
    return stepMutation(ids(layout.releases), item.id, key, UP, DOWN, moveRelease);
  }
  if (item.kind === ITEM_KIND.ACTIVITY) {
    return stepMutation(ids(layout.activities), item.id, key, LEFT, RIGHT, moveActivity);
  }
  if (item.kind === ITEM_KIND.TASK) return taskKeyMove(layout, item, key);
  if (item.kind === ITEM_KIND.STORY) return storyKeyMove(layout, item, key);
  return null;
}

function taskKeyMove(layout, { id, column }, key) {
  const { activities } = layout;
  const activity = activities[column.activityIndex];
  const siblings = ids(activity.tasks);
  const within = stepMutation(siblings, id, key, LEFT, RIGHT, (doc, taskId, beforeId) =>
    moveTask(doc, taskId, { activityId: activity.id, beforeId }),
  );
  if (within) return within;
  // At an edge: into the nearest activity that is not folded (a task moved into a folded one
  // would vanish from view), at its end (left) or its start (right).
  const atEdge = (key === LEFT && siblings[0] === id) || (key === RIGHT && siblings.at(-1) === id);
  if (!atEdge) return null;
  const step = key === LEFT ? -1 : 1;
  let index = column.activityIndex + step;
  while (activities[index]?.folded) index += step;
  const neighbour = activities[index];
  if (!neighbour?.id) return null;
  const beforeId = key === RIGHT ? (ids(neighbour.tasks)[0] ?? null) : null;
  return (doc) => moveTask(doc, id, { activityId: neighbour.id, beforeId });
}

function storyKeyMove(layout, { id, column, row }, key) {
  // Folded release rows are skipped: a story moved into one would vanish from view.
  const visibleRows = layout.releases.filter((release) => !release.folded);
  // From the Unassigned row, a story can only go up, into the last visible release.
  if (row === UNASSIGNED) {
    const last = visibleRows.at(-1);
    return key === UP && last && column.task?.id != null
      ? (doc) => moveStory(doc, id, { taskId: column.task.id, release: last.id })
      : null;
  }
  if (key === UP || key === DOWN) {
    const inCell = cellIds(layout.storiesIn(column, row));
    const within = stepMutation(inCell, id, key, UP, DOWN, (doc, storyId, beforeId) =>
      moveStory(doc, storyId, { taskId: column.task.id, release: row.id, beforeId }),
    );
    if (within) return within;
    const here = visibleRows.findIndex((r) => r.id === row.id);
    const neighbour = here >= 0 ? visibleRows[here + (key === UP ? -1 : 1)] : null;
    return neighbour
      ? (doc) => moveStory(doc, id, { taskId: column.task.id, release: neighbour.id })
      : null;
  }
  // Left and right: the nearest column with a task, outside folded activities.
  const step = key === LEFT ? -1 : key === RIGHT ? 1 : 0;
  if (!step) return null;
  const index = layout.columns.indexOf(column);
  for (let i = index + step; i >= 0 && i < layout.columns.length; i += step) {
    const target = layout.columns[i];
    if (canDropStories(target, row)) {
      return (doc) => moveStory(doc, id, { taskId: target.task.id, release: row.id });
    }
  }
  return null;
}
