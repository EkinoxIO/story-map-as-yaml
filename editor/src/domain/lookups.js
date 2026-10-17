// Where things are in a story map: paths into the document, lookups by id, ids and counts.
import { ITEM_KIND } from "./vocabulary.js";

export const releasePath = (releaseIndex) => ["releases", releaseIndex];
export const activityPath = (activityIndex) => ["activities", activityIndex];
export const taskPath = (activityIndex, taskIndex) => [
  ...activityPath(activityIndex),
  "tasks",
  taskIndex,
];
export const tasksPath = (activityIndex) => [...activityPath(activityIndex), "tasks"];
export const storiesPath = (activityIndex, taskIndex) => [
  ...taskPath(activityIndex, taskIndex),
  "stories",
];
export const storyPath = (activityIndex, taskIndex, storyIndex) => [
  ...storiesPath(activityIndex, taskIndex),
  storyIndex,
];

/** Every story of a plain story map object, with where it sits. */
export function allStories(storyMap) {
  return (storyMap.activities || []).flatMap((activity, activityIndex) =>
    (activity.tasks || []).flatMap((task, taskIndex) =>
      (task.stories || []).map((story, storyIndex) => ({
        story,
        activityIndex,
        taskIndex,
        storyIndex,
        path: storyPath(activityIndex, taskIndex, storyIndex),
      })),
    ),
  );
}

/**
 * Where the item with `id` currently is, or null when there is none. `kind` is an ITEM_KIND;
 * the result holds the indices that kind is addressed by,
 * e.g. { activityIndex, taskIndex } for a task. With duplicate ids, the first one wins.
 */
export function locate(storyMap, kind, id) {
  const activities = storyMap.activities || [];
  if (kind === ITEM_KIND.RELEASE) {
    const releaseIndex = (storyMap.releases || []).findIndex((r) => r.id === id);
    return releaseIndex < 0 ? null : { releaseIndex };
  }
  if (kind === ITEM_KIND.ACTIVITY) {
    const activityIndex = activities.findIndex((a) => a.id === id);
    return activityIndex < 0 ? null : { activityIndex };
  }
  if (kind === ITEM_KIND.TASK) {
    for (const [activityIndex, activity] of activities.entries()) {
      const taskIndex = (activity.tasks || []).findIndex((t) => t.id === id);
      if (taskIndex >= 0) return { activityIndex, taskIndex };
    }
    return null;
  }
  if (kind === ITEM_KIND.STORY) {
    const found = allStories(storyMap).find(({ story }) => story.id === id);
    return found
      ? {
          activityIndex: found.activityIndex,
          taskIndex: found.taskIndex,
          storyIndex: found.storyIndex,
        }
      : null;
  }
  throw new Error(`Unknown item kind: ${kind}`);
}

/**
 * The item of `kind` at the given indices (as returned by `locate`), or undefined when
 * there is none.
 */
export function itemAt(storyMap, kind, { releaseIndex, activityIndex, taskIndex, storyIndex }) {
  const activity = storyMap.activities?.[activityIndex];
  const task = activity?.tasks?.[taskIndex];
  if (kind === ITEM_KIND.RELEASE) return storyMap.releases?.[releaseIndex];
  if (kind === ITEM_KIND.ACTIVITY) return activity;
  if (kind === ITEM_KIND.TASK) return task;
  if (kind === ITEM_KIND.STORY) return task?.stories?.[storyIndex];
  throw new Error(`Unknown item kind: ${kind}`);
}

/** Next id after the highest numbered one, e.g. (["US-101", "US-107"], "US-") -> "US-108". */
export function nextId(ids, prefix) {
  const numbers = ids
    .filter((id) => String(id).startsWith(prefix))
    .map((id) => Number(String(id).slice(prefix.length)))
    .filter(Number.isInteger);
  return prefix + (Math.max(0, ...numbers) + 1);
}

/** Number of stories matching `predicate`, which receives the entries of `allStories`. */
export function countStories(storyMap, predicate = () => true) {
  return allStories(storyMap).filter(predicate).length;
}
