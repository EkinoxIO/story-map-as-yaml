// How a story map is laid out as a grid: one column per task, one row per release, and
// which stories go in which cell. Pure functions: no React, no DOM.
import { allStories } from "./domain/storyMap.js";
import { foldKey } from "./folding.js";

/** The extra row for stories whose release is not listed under `releases`. */
export const UNASSIGNED = Object.freeze({
  id: "__unassigned__",
  title: "Unassigned",
  goal: "Stories whose release is not listed under `releases`.",
});

/**
 * The grid for `storyMap`, given which items are folded (`isFolded(foldKey)`):
 * - activities: the activities (with their index and whether they are folded)
 * - columns: one per task, or one for an activity without tasks; each knows its activity
 *   and task indices, its task, its fold key, and whether it or its activity is folded
 * - rows: the releases (with their index and whether they are folded), plus UNASSIGNED when
 *   some stories need it
 * - storiesIn(column, row): the stories of that cell, in file order, with their indices
 */
export function buildLayout(storyMap, isFolded = () => false) {
  const activities = (storyMap.activities || []).map((activity, activityIndex) => ({
    ...activity,
    activityIndex,
    folded: isFolded(foldKey.activity(activity, activityIndex)),
  }));
  const columns = activities.flatMap((activity, activityIndex) => {
    const tasks = activity.tasks || [];
    const activityFolded = activity.folded;
    if (!tasks.length) {
      return [{ key: `${activityIndex}-empty`, activityIndex, task: null, activityFolded }];
    }
    return tasks.map((task, taskIndex) => {
      const taskFoldKey = foldKey.task(task, activityIndex, taskIndex);
      return {
        key: task.id ?? `${activityIndex}-${taskIndex}`,
        activityIndex,
        taskIndex,
        task,
        foldKey: taskFoldKey,
        activityFolded,
        taskFolded: !activityFolded && isFolded(taskFoldKey),
      };
    });
  });
  const releases = (storyMap.releases || []).map((release, releaseIndex) => ({
    ...release,
    releaseIndex,
    folded: isFolded(foldKey.release(release)),
  }));
  const knownReleases = new Set(releases.map((r) => r.id));
  const stories = allStories(storyMap);
  const hasUnassigned = stories.some(({ story }) => !knownReleases.has(story.release));
  const rows = hasUnassigned ? [...releases, UNASSIGNED] : releases;

  function storiesIn(column, row) {
    return stories.filter(
      ({ story, activityIndex, taskIndex }) =>
        activityIndex === column.activityIndex &&
        taskIndex === column.taskIndex &&
        (row === UNASSIGNED ? !knownReleases.has(story.release) : story.release === row.id),
    );
  }

  return { activities, columns, releases, rows, storiesIn };
}

/** Folded columns are only as wide as their content; the others have the standard width. */
export function columnWidth(column) {
  return column.activityFolded || column.taskFolded ? "max-content" : "var(--col-width)";
}
