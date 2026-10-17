// Folding is a viewing choice: it lives in the page, never in the YAML file. Folded items
// are remembered by key, so they stay folded when the file reloads or items move.
// Pure: the fold state itself is kept by the useFolding hook.

/** Keys of foldable items: by id, falling back to the position for items without one. */
export const foldKey = {
  activity: (activity, activityIndex) => `activity:${activity.id ?? activityIndex}`,
  task: (task, activityIndex, taskIndex) => `task:${task.id ?? `${activityIndex}-${taskIndex}`}`,
  release: (release) => `release:${release.id}`,
};
