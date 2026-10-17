// Adding, changing and deleting releases, activities, tasks and stories, with their rules.
import { STATUSES, ID_PREFIX, STORY_ID_PATTERN, StoryMapError } from "./vocabulary.js";
import {
  releasePath,
  activityPath,
  taskPath,
  tasksPath,
  storiesPath,
  storyPath,
  allStories,
  allTasks,
  nextId,
  countStories,
} from "./lookups.js";
import { plural } from "./text.js";
import { append, setFields } from "./nodes.js";

function requireTitle(title) {
  if (!title || !title.trim()) throw new StoryMapError("The title cannot be empty.");
}

// --- Story map ----------------------------------------------------------------------

export function setMapTitle(doc, title) {
  requireTitle(title);
  doc.setIn(["title"], title);
}

// --- Releases -----------------------------------------------------------------------

function requireRelease({ id, title, goal }, otherIds) {
  if (!id) throw new StoryMapError("The release id cannot be empty.");
  requireTitle(title);
  if (!goal) throw new StoryMapError("The release goal cannot be empty.");
  if (otherIds.includes(id)) throw new StoryMapError(`A release with id "${id}" already exists.`);
}

export function addRelease(doc, { id, title, goal }) {
  const releases = doc.toJS().releases || [];
  requireRelease(
    { id, title, goal },
    releases.map((r) => r.id),
  );
  append(doc, ["releases"], { id, title, goal });
}

/** Updates a release; when its id changes, the stories that referred to it follow. */
export function updateRelease(doc, releaseIndex, { id, title, goal }) {
  const storyMap = doc.toJS();
  const releases = storyMap.releases || [];
  const previousId = releases[releaseIndex].id;
  requireRelease(
    { id, title, goal },
    releases.filter((_, i) => i !== releaseIndex).map((r) => r.id),
  );
  setFields(doc, releasePath(releaseIndex), { id, title, goal });
  if (id !== previousId) {
    for (const { story, path } of allStories(storyMap)) {
      if (story.release === previousId) doc.setIn([...path, "release"], id);
    }
  }
}

/** Deletes a release; refused while stories still belong to it, so none become orphans. */
export function deleteRelease(doc, releaseIndex) {
  const storyMap = doc.toJS();
  const { id } = storyMap.releases[releaseIndex];
  const count = countStories(storyMap, ({ story }) => story.release === id);
  if (count) {
    throw new StoryMapError(
      `Release ${id} still has ${plural(count, "story", "stories")}: move or delete them first.`,
    );
  }
  doc.deleteIn(releasePath(releaseIndex));
}

// --- Activities and tasks -----------------------------------------------------------

/** Adds an activity with no tasks and returns its id. */
export function addActivity(doc, title) {
  requireTitle(title);
  const activities = doc.toJS().activities || [];
  const id = nextId(
    activities.map((a) => a.id),
    ID_PREFIX.activity,
  );
  append(doc, ["activities"], { id, title, tasks: [] });
  return id;
}

export function renameActivity(doc, activityIndex, title) {
  requireTitle(title);
  doc.setIn([...activityPath(activityIndex), "title"], title);
}

/** Deletes an activity together with its tasks and their stories. */
export function deleteActivity(doc, activityIndex) {
  doc.deleteIn(activityPath(activityIndex));
}

/**
 * Adds a task with no stories to an activity and returns its id.
 * Task ids are unique across the whole map, not per activity.
 */
export function addTask(doc, activityIndex, title) {
  requireTitle(title);
  const taskIds = allTasks(doc.toJS()).map((task) => task.id);
  const id = nextId(taskIds, ID_PREFIX.task);
  append(doc, tasksPath(activityIndex), { id, title, stories: [] });
  return id;
}

export function renameTask(doc, activityIndex, taskIndex, title) {
  requireTitle(title);
  doc.setIn([...taskPath(activityIndex, taskIndex), "title"], title);
}

/** Deletes a task together with its stories. */
export function deleteTask(doc, activityIndex, taskIndex) {
  doc.deleteIn(taskPath(activityIndex, taskIndex));
}

// --- Stories ------------------------------------------------------------------------

function requireStory({ title, release }) {
  requireTitle(title);
  if (!release) throw new StoryMapError("A story needs a release: add a release first.");
}

// A story id must match the schema's pattern and be unique among `otherIds`.
function requireStoryId(id, otherIds) {
  if (!STORY_ID_PATTERN.test(id ?? "")) {
    throw new StoryMapError(`"${id ?? ""}" is not a valid story id: use the form US-123.`);
  }
  if (otherIds.includes(id)) throw new StoryMapError(`A story with id "${id}" already exists.`);
}

/** The id a new story gets unless another one is chosen: after the highest US- number. */
export function nextStoryId(storyMap) {
  return nextId(
    allStories(storyMap).map(({ story }) => story.id),
    ID_PREFIX.story,
  );
}

/** Adds a story to a task and returns its id: `id` when given, else the next free one. */
export function addStory(
  doc,
  activityIndex,
  taskIndex,
  { id, title, release, status = STATUSES[0] },
) {
  const storyMap = doc.toJS();
  const storyId = id ?? nextStoryId(storyMap);
  requireStoryId(
    storyId,
    allStories(storyMap).map(({ story }) => story.id),
  );
  requireStory({ title, release });
  append(doc, storiesPath(activityIndex, taskIndex), {
    id: storyId,
    title,
    release,
    status,
  });
  return storyId;
}

/**
 * Updates the given fields of a story; fields not passed are left as they are. A new id must
 * be valid and not used by another story.
 */
export function updateStory(doc, activityIndex, taskIndex, storyIndex, fields) {
  const path = storyPath(activityIndex, taskIndex, storyIndex);
  const current = doc.getIn(path).toJSON();
  if ("id" in fields && fields.id !== current.id) {
    const isThisStory = (entry) =>
      entry.activityIndex === activityIndex &&
      entry.taskIndex === taskIndex &&
      entry.storyIndex === storyIndex;
    const otherIds = allStories(doc.toJS())
      .filter((entry) => !isThisStory(entry))
      .map(({ story }) => story.id);
    requireStoryId(fields.id, otherIds);
  }
  if ("title" in fields || "release" in fields) requireStory({ ...current, ...fields });
  setFields(doc, path, fields);
}

export function deleteStory(doc, activityIndex, taskIndex, storyIndex) {
  doc.deleteIn(storyPath(activityIndex, taskIndex, storyIndex));
}
