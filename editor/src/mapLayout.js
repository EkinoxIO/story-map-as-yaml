// How a story map is laid out as a grid: one column per task, one row per release, and
// which stories go in which cell. Pure functions: no React, no DOM.
import { allStories } from "./domain/storyMap.js";

/** The extra row for stories whose release is not listed under `releases`. */
export const UNASSIGNED = Object.freeze({
  id: "__unassigned__",
  title: "Unassigned",
  goal: "Stories whose release is not listed under `releases`.",
});

/**
 * The grid for `storyMap`:
 * - activities: the activities, with their index
 * - columns: one per task, or one for an activity without tasks; each knows its activity
 *   and task indices and its task
 * - releases: the releases of the file, with their index
 * - rows: the rows of the grid: the releases, plus UNASSIGNED when some stories need it
 * - storiesIn(column, row): the stories of that cell, in file order, with their indices
 */
export function buildLayout(storyMap) {
  const activities = (storyMap.activities || []).map((activity, activityIndex) => ({
    ...activity,
    activityIndex,
  }));
  const columns = activities.flatMap((activity, activityIndex) => {
    const tasks = activity.tasks || [];
    if (!tasks.length) return [{ key: `${activityIndex}-empty`, activityIndex, task: null }];
    return tasks.map((task, taskIndex) => ({
      key: task.id ?? `${activityIndex}-${taskIndex}`,
      activityIndex,
      taskIndex,
      task,
    }));
  });
  const releases = (storyMap.releases || []).map((release, releaseIndex) => ({
    ...release,
    releaseIndex,
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
