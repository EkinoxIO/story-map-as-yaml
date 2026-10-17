// Reordering: moving releases, activities, tasks and stories, possibly into another
// activity, task or release.
import { isMap, isSeq } from "yaml";
import { ITEM_KIND, StoryMapError } from "./vocabulary.js";
import { tasksPath, storiesPath, locate } from "./lookups.js";
import { insertNode, giveSequenceCommentTo } from "./nodes.js";

function idOf(node) {
  return isMap(node) ? node.get("id") : undefined;
}

function itemsAt(doc, path) {
  const seq = doc.getIn(path);
  return isSeq(seq) ? seq.items : [];
}

// Where the item `id` of `kind` (an ITEM_KIND) is; refuses an id the map does not have.
function mustLocate(storyMap, kind, id) {
  const found = locate(storyMap, kind, id);
  if (!found) throw new StoryMapError(`There is no ${kind} with id "${id}".`);
  return found;
}

// Moves a release or an activity: items of the top-level sequence `key`.
function moveTopLevel(doc, key, kind, id, beforeId) {
  if (id === beforeId) return false;
  const found = mustLocate(doc.toJS(), kind, id);
  const index = kind === ITEM_KIND.RELEASE ? found.releaseIndex : found.activityIndex;
  return moveNode(doc, { fromPath: [key], fromIndex: index, toPath: [key], beforeId });
}

// Moves the node at `fromIndex` of the sequence at `fromPath` into the sequence at `toPath`,
// before the item whose id is `beforeId`; without one, at `endIndex(items, node)` (default:
// last), which sees the node after `update`. Comments attached to the node move with it.
// `update(node)` may change the node and returns whether it did. Returns false when the node
// ends up unchanged where it was.
function moveNode(
  doc,
  { fromPath, fromIndex, toPath, beforeId, endIndex = (items) => items.length, update },
) {
  const fromSeq = doc.getIn(fromPath);
  const [node] = fromSeq.items.splice(fromIndex, 1);
  if (fromIndex === 0) giveSequenceCommentTo(fromSeq, node);
  const updated = update?.(node) ?? false;
  const items = itemsAt(doc, toPath);
  const beforeIndex = beforeId == null ? -1 : items.findIndex((item) => idOf(item) === beforeId);
  const index = Math.min(beforeIndex >= 0 ? beforeIndex : endIndex(items, node), items.length);
  insertNode(doc, toPath, index, node);
  return updated || doc.getIn(toPath) !== fromSeq || index !== fromIndex;
}

/** Moves a release before the release `beforeId`, or to the end when it is null. */
export function moveRelease(doc, releaseId, beforeId = null) {
  return moveTopLevel(doc, "releases", ITEM_KIND.RELEASE, releaseId, beforeId);
}

/** Moves an activity, with its tasks and stories, before `beforeId` or to the end. */
export function moveActivity(doc, activityId, beforeId = null) {
  return moveTopLevel(doc, "activities", ITEM_KIND.ACTIVITY, activityId, beforeId);
}

/**
 * Moves a task, with its stories, into the activity `activityId` (possibly another one),
 * before the task `beforeId` or at the end of that activity.
 */
export function moveTask(doc, taskId, { activityId, beforeId = null }) {
  if (taskId === beforeId) return false;
  const storyMap = doc.toJS();
  const from = mustLocate(storyMap, ITEM_KIND.TASK, taskId);
  const to = mustLocate(storyMap, ITEM_KIND.ACTIVITY, activityId);
  return moveNode(doc, {
    fromPath: tasksPath(from.activityIndex),
    fromIndex: from.taskIndex,
    toPath: tasksPath(to.activityIndex),
    beforeId,
  });
}

/**
 * Moves a story into the task `taskId` (possibly another one) and, when `release` is given,
 * into that release (another row of the map). It goes before the story `beforeId`, or else
 * after the last story of that task in the same release, so the file keeps stories of a
 * release together.
 */
export function moveStory(doc, storyId, { taskId, release, beforeId = null }) {
  if (storyId === beforeId) return false;
  const storyMap = doc.toJS();
  const from = mustLocate(storyMap, ITEM_KIND.STORY, storyId);
  const to = mustLocate(storyMap, ITEM_KIND.TASK, taskId);
  if (release != null) mustLocate(storyMap, ITEM_KIND.RELEASE, release);
  return moveNode(doc, {
    fromPath: storiesPath(from.activityIndex, from.taskIndex),
    fromIndex: from.storyIndex,
    toPath: storiesPath(to.activityIndex, to.taskIndex),
    beforeId,
    update: (node) => {
      const changes = release != null && node.get("release") !== release;
      if (changes) node.set("release", release);
      return changes;
    },
    endIndex: (items, node) => {
      const last = items.findLastIndex(
        (item) => isMap(item) && item.get("release") === node.get("release"),
      );
      return last >= 0 ? last + 1 : items.length;
    },
  });
}
