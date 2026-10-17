// Folding is a viewing choice: it lives in the page, never in the YAML file. Folded items
// are remembered by key, so they stay folded when the file reloads or items move.
// Pure: the fold state itself is kept by the useFolding hook.

// An item without an id is keyed by its position, after "@" rather than ":", so that key can
// never equal the key of an item whose id happens to look like a position (such as "1").
const keyOf = (kind, id, position) => (id != null ? `${kind}:${id}` : `${kind}@${position}`);

/** Keys of foldable items: by id, falling back to the position for items without one. */
export const foldKey = {
  activity: (activity, activityIndex) => keyOf("activity", activity.id, activityIndex),
  task: (task, activityIndex, taskIndex) => keyOf("task", task.id, `${activityIndex}-${taskIndex}`),
  release: (release, releaseIndex) => keyOf("release", release.id, releaseIndex),
};
