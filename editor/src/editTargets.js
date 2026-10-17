// Maps a click on the story map (an "edit target") to the edit dialog to show
// and to the domain operations its Save and Delete buttons run.
import {
  STATUSES,
  setMapTitle,
  addRelease,
  updateRelease,
  deleteRelease,
  addActivity,
  renameActivity,
  deleteActivity,
  addTask,
  renameTask,
  deleteTask,
  addStory,
  updateStory,
  deleteStory,
  countStories,
  plural,
  locate,
  itemAt,
  nextStoryId,
  ITEM_KIND,
} from "./domain/storyMap.js";

// What can be clicked to edit: every item kind of the domain, plus the map itself.
export const EDIT_KIND = Object.freeze({ ...ITEM_KIND, MAP: "map" });

const titleField = { name: "title", label: "Title", required: true };

// Keeps a value the schema does not know about selectable, so opening a dialog never changes it.
function options(known, current) {
  return [...new Set([...known, current].filter(Boolean))];
}

function contentsOf(storyCount, taskCount) {
  const parts = [];
  if (taskCount) parts.push(plural(taskCount, "task"));
  if (storyCount) parts.push(plural(storyCount, "story", "stories"));
  return parts.length ? ` with its ${parts.join(" and ")}` : "";
}

// Activities and tasks are both a titled node holding children, so they share one dialog:
// `node` is null when adding, and add/rename/remove are the domain operations to run.
function titledNodeDialog(applyAndSave, { node, label, addTitle, contents, add, rename, remove }) {
  return {
    title: node ? `Edit ${label}` : addTitle,
    fields: [titleField],
    initial: { title: node?.title || "" },
    onSave: (values) =>
      applyAndSave((doc) => (node ? rename(doc, values.title) : add(doc, values.title))),
    onDelete: node && (() => applyAndSave(remove)),
    deleteConfirmation: node && `Delete ${label} "${node.title}"${contents}?`,
  };
}

// Each builder receives the resolved target, the plain story map and `applyAndSave(mutate)`.
const builders = {
  [EDIT_KIND.MAP]: (_target, storyMap, applyAndSave) => ({
    title: "Edit story map",
    fields: [titleField],
    initial: { title: storyMap.title || "" },
    onSave: (values) => applyAndSave((doc) => setMapTitle(doc, values.title)),
  }),

  [EDIT_KIND.RELEASE]: ({ releaseIndex }, storyMap, applyAndSave) => {
    const release = releaseIndex != null ? storyMap.releases[releaseIndex] : null;
    return {
      title: release ? `Edit release ${release.id}` : "Add release",
      fields: [
        { name: "id", label: "Id (stories refer to it)", required: true },
        titleField,
        { name: "goal", label: "Goal", required: true, multiline: true },
      ],
      initial: { id: release?.id || "", title: release?.title || "", goal: release?.goal || "" },
      onSave: (values) =>
        applyAndSave((doc) =>
          release ? updateRelease(doc, releaseIndex, values) : addRelease(doc, values),
        ),
      onDelete: release && (() => applyAndSave((doc) => deleteRelease(doc, releaseIndex))),
      deleteConfirmation: release && `Delete release "${release.title}"?`,
    };
  },

  [EDIT_KIND.ACTIVITY]: ({ activityIndex }, storyMap, applyAndSave) => {
    const activity = activityIndex != null ? storyMap.activities[activityIndex] : null;
    const storyCount = countStories(storyMap, (s) => s.activityIndex === activityIndex);
    return titledNodeDialog(applyAndSave, {
      node: activity,
      label: "activity",
      addTitle: "Add activity",
      contents: contentsOf(storyCount, (activity?.tasks || []).length),
      add: (doc, title) => addActivity(doc, title),
      rename: (doc, title) => renameActivity(doc, activityIndex, title),
      remove: (doc) => deleteActivity(doc, activityIndex),
    });
  },

  [EDIT_KIND.TASK]: ({ activityIndex, taskIndex }, storyMap, applyAndSave) => {
    const activity = storyMap.activities[activityIndex];
    const task = taskIndex != null ? activity.tasks[taskIndex] : null;
    return titledNodeDialog(applyAndSave, {
      node: task,
      label: "task",
      addTitle: `Add task to "${activity.title}"`,
      contents: contentsOf((task?.stories || []).length, 0),
      add: (doc, title) => addTask(doc, activityIndex, title),
      rename: (doc, title) => renameTask(doc, activityIndex, taskIndex, title),
      remove: (doc) => deleteTask(doc, activityIndex, taskIndex),
    });
  },

  [EDIT_KIND.STORY]: (
    { activityIndex, taskIndex, storyIndex, release },
    storyMap,
    applyAndSave,
  ) => {
    const task = storyMap.activities[activityIndex].tasks[taskIndex];
    const story = storyIndex != null ? task.stories[storyIndex] : null;
    const releaseIds = (storyMap.releases || []).map((r) => r.id);
    // A new story gets the next free id, which can be changed like any other field.
    const initial = story
      ? {
          title: story.title || "",
          id: story.id ?? "",
          release: story.release,
          status: story.status,
        }
      : {
          title: "",
          id: nextStoryId(storyMap),
          release: release || releaseIds[0],
          status: STATUSES[0],
        };
    return {
      title: story ? `Edit ${story.id}` : `Add story to "${task.title}"`,
      fields: [
        titleField,
        { name: "id", label: "Id", required: true },
        { name: "release", label: "Release", options: options(releaseIds, initial.release) },
        { name: "status", label: "Status", options: options(STATUSES, initial.status) },
      ],
      initial,
      onSave: (values) =>
        applyAndSave((doc) =>
          story
            ? updateStory(doc, activityIndex, taskIndex, storyIndex, values)
            : addStory(doc, activityIndex, taskIndex, values),
        ),
      onDelete:
        story &&
        (() => applyAndSave((doc) => deleteStory(doc, activityIndex, taskIndex, storyIndex))),
      deleteConfirmation: story && `Delete ${story.id} "${story.title}"?`,
    };
  },
};

// For adding, a target names the container by `parentId`: the activity a task is added to,
// the task a story is added to.
const PARENT_KIND = { [EDIT_KIND.TASK]: EDIT_KIND.ACTIVITY, [EDIT_KIND.STORY]: EDIT_KIND.TASK };

// A target holds the indices of what was clicked plus its id (or its container's id when
// adding). The file can change on disk while a dialog is open, so the indices are checked
// against the current map and re-found by id when the item moved. Null when it is gone.
function resolve(target, storyMap) {
  const [kind, id] =
    target.id != null
      ? [target.kind, target.id]
      : target.parentId != null
        ? [PARENT_KIND[target.kind], target.parentId]
        : [];
  if (!kind || itemAt(storyMap, kind, target)?.id === id) return target;
  const found = locate(storyMap, kind, id);
  return found && { ...target, ...found };
}

/**
 * Props for EditDialog: title, fields, initial values and onSave, plus onDelete and
 * deleteConfirmation when the target can be deleted. Null when the targeted item no longer
 * exists. `applyAndSave(mutate)` applies a domain operation to the document and saves it.
 */
export function dialogFor(target, storyMap, applyAndSave) {
  const build = builders[target.kind];
  if (!build) throw new Error(`Unknown edit target kind: ${target.kind}`);
  const resolved = resolve(target, storyMap);
  return resolved && build(resolved, storyMap, applyAndSave);
}
