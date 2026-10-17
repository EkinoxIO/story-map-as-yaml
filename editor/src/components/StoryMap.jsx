import { Fragment } from "react";
import {
  ITEM_KIND,
  allStories,
  moveActivity,
  moveRelease,
  moveStory,
  moveTask,
} from "../domain/storyMap.js";
import { EDIT_KIND } from "../editTargets.js";
import { statusColor } from "../statusColors.js";
import useDragAndDrop from "../useDragAndDrop.js";
import { foldKey } from "../folding.js";
import useFolding from "../useFolding.js";

const UNASSIGNED = {
  id: "__unassigned__",
  title: "Unassigned",
  goal: "Stories whose release is not listed under `releases`.",
};

function FoldToggle({ folded, label, onToggle }) {
  return (
    <button
      type="button"
      className="fold"
      aria-expanded={!folded}
      aria-label={`${folded ? "Unfold" : "Fold"} ${label}`}
      title={folded ? "Unfold" : "Fold"}
      onClick={onToggle}
    >
      {folded ? "▸" : "▾"}
    </button>
  );
}

// A compact card (under a folded task) shows only the story id and, through its left border
// color, its status: how many stories and how far along, not what they are.
function StoryCard({ story, compact, onClick, rootProps }) {
  const style = { "--status-color": statusColor(story.status) };
  if (compact) {
    return (
      <button
        className="block story compact"
        style={style}
        title={story.id}
        onClick={onClick}
        {...rootProps}
      >
        <div className="id">{story.id}</div>
      </button>
    );
  }
  return (
    <button className="block story" style={style} onClick={onClick} {...rootProps}>
      <div className="id">{story.id}</div>
      <div>{story.title}</div>
      <div className="tags">{story.status && <span className="tag">{story.status}</span>}</div>
    </button>
  );
}

// A folded release keeps its title and id; its goal and stories are hidden.
function ReleaseBand({ release, folded, onToggle, onEdit, rootProps }) {
  const toggle = (
    <FoldToggle folded={folded} label={`release ${release.title}`} onToggle={onToggle} />
  );
  if (release === UNASSIGNED) {
    return (
      <div className="release">
        {toggle}
        <div>
          <strong>{release.title}</strong>
          {!folded && <div className="goal">{release.goal}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="release" {...rootProps}>
      {toggle}
      <button
        className="block"
        onClick={() =>
          onEdit({ kind: EDIT_KIND.RELEASE, releaseIndex: release.releaseIndex, id: release.id })
        }
      >
        <strong>{release.title}</strong>
        <span className="tag">{release.id}</span>
        {!folded && <div className="goal">{release.goal}</div>}
      </button>
    </div>
  );
}

function Cell({ column, release, stories, onEdit, rootProps, storyProps }) {
  // Nothing shows under a folded activity.
  if (column.activityFolded) return <div className="cell" />;
  const { activityIndex, taskIndex, taskFolded } = column;
  return (
    <div className="cell" {...rootProps}>
      {stories.map(({ story, storyIndex }) => (
        <StoryCard
          key={story.id ?? storyIndex}
          story={story}
          compact={taskFolded}
          rootProps={storyProps(story)}
          onClick={() =>
            onEdit({ kind: EDIT_KIND.STORY, activityIndex, taskIndex, storyIndex, id: story.id })
          }
        />
      ))}
      {column.task && !taskFolded && release !== UNASSIGNED && (
        <button
          className="add"
          onClick={() =>
            onEdit({
              kind: EDIT_KIND.STORY,
              activityIndex,
              taskIndex,
              parentId: column.task.id,
              release: release.id,
            })
          }
        >
          + Story
        </button>
      )}
    </div>
  );
}

// A folded activity keeps its title over one narrow, empty column per task.
function ActivityHeader({ activity, activityIndex, span, folded, onToggle, onEdit, rootProps }) {
  return (
    <div className="activity" style={{ gridColumn: `span ${span}` }} {...rootProps}>
      <FoldToggle folded={folded} label={`activity ${activity.title}`} onToggle={onToggle} />
      <button
        className="block"
        onClick={() => onEdit({ kind: EDIT_KIND.ACTIVITY, activityIndex, id: activity.id })}
      >
        {activity.title}
      </button>
      {!folded && (
        <button
          className="add"
          title="Add task"
          onClick={() => onEdit({ kind: EDIT_KIND.TASK, activityIndex, parentId: activity.id })}
        >
          +
        </button>
      )}
    </div>
  );
}

// A folded task keeps its title, in a column only as wide as needed; its stories show
// only their id. Under a folded activity, each task is an empty block: the number of tasks
// stays visible, not their titles.
function TaskHeader({ column, onToggle, onEdit, rootProps }) {
  const { activityIndex, taskIndex, task } = column;
  if (column.activityFolded) return <div className="task placeholder" aria-hidden="true" />;
  if (!task) {
    return (
      <div className="task empty" {...rootProps}>
        No task yet
      </div>
    );
  }
  return (
    <div className="task" {...rootProps}>
      <FoldToggle folded={column.taskFolded} label={`task ${task.title}`} onToggle={onToggle} />
      <button
        className="block"
        onClick={() => onEdit({ kind: EDIT_KIND.TASK, activityIndex, taskIndex, id: task.id })}
      >
        {task.title}
      </button>
    </div>
  );
}

// Folded columns are only as wide as their content; the others have the standard width.
function columnWidth(column) {
  return column.activityFolded || column.taskFolded ? "max-content" : "var(--col-width)";
}

// The id after `id` in `ids`, or null when it is the last: dropping "after" an item means
// dropping before the next one.
function nextAfter(ids, id) {
  return ids[ids.indexOf(id) + 1] ?? null;
}

const ids = (items) => (items || []).map((item) => item.id);

export default function StoryMap({ storyMap, onEdit, onMove }) {
  const { isFolded, toggle } = useFolding();
  const { draggable, dropTarget } = useDragAndDrop(onMove);
  const is = (kind) => (dragged) => dragged.kind === kind;
  const activities = storyMap.activities || [];
  // One column per task; an activity without tasks still gets one, so it can be filled.
  const columns = activities.flatMap((activity, activityIndex) => {
    const tasks = activity.tasks || [];
    const activityFolded = isFolded(foldKey.activity(activity, activityIndex));
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
  }));
  const knownReleases = new Set(releases.map((r) => r.id));
  const stories = allStories(storyMap);
  const hasUnassigned = stories.some(({ story }) => !knownReleases.has(story.release));
  const rows = hasUnassigned ? [...releases, UNASSIGNED] : releases;

  // Drag and drop: what each element can take, and which domain move a drop runs.
  const releaseProps = (release) =>
    release === UNASSIGNED || release.id == null
      ? {}
      : {
          ...draggable({ kind: ITEM_KIND.RELEASE, id: release.id }),
          ...dropTarget({
            key: `release:${release.id}`,
            accepts: is(ITEM_KIND.RELEASE),
            axis: () => "y",
            move: (dragged, after) => (doc) =>
              moveRelease(
                doc,
                dragged.id,
                after ? nextAfter(ids(releases), release.id) : release.id,
              ),
          }),
        };

  // An activity takes activities (before or after it) and tasks (at its end).
  const activityProps = (activity) =>
    activity.id == null
      ? {}
      : {
          ...draggable({ kind: ITEM_KIND.ACTIVITY, id: activity.id }),
          ...dropTarget({
            key: `activity:${activity.id}`,
            accepts: (dragged) => is(ITEM_KIND.ACTIVITY)(dragged) || is(ITEM_KIND.TASK)(dragged),
            axis: (dragged) => (is(ITEM_KIND.ACTIVITY)(dragged) ? "x" : null),
            move: (dragged, after) => (doc) =>
              is(ITEM_KIND.TASK)(dragged)
                ? moveTask(doc, dragged.id, { activityId: activity.id })
                : moveActivity(
                    doc,
                    dragged.id,
                    after ? nextAfter(ids(activities), activity.id) : activity.id,
                  ),
          }),
        };

  // A task header takes tasks, from any activity; "No task yet" takes them into its activity.
  const taskProps = (column) => {
    const activity = activities[column.activityIndex];
    if (activity.id == null) return {};
    if (!column.task) {
      return dropTarget({
        key: `empty:${activity.id}`,
        accepts: is(ITEM_KIND.TASK),
        move: (dragged) => (doc) => moveTask(doc, dragged.id, { activityId: activity.id }),
      });
    }
    const { task } = column;
    if (task.id == null) return {};
    return {
      ...draggable({ kind: ITEM_KIND.TASK, id: task.id }),
      ...dropTarget({
        key: `task:${task.id}`,
        accepts: is(ITEM_KIND.TASK),
        axis: () => "x",
        move: (dragged, after) => (doc) =>
          moveTask(doc, dragged.id, {
            activityId: activity.id,
            beforeId: after ? nextAfter(ids(activity.tasks), task.id) : task.id,
          }),
      }),
    };
  };

  // A cell takes stories into its task and release, at the end of that release's stories;
  // a story card takes them before or after itself. Stories can be dragged out of the
  // Unassigned row, not into it.
  const canDropStories = (column, release) =>
    column.task?.id != null && release !== UNASSIGNED && !column.activityFolded;

  const cellProps = (column, release) =>
    canDropStories(column, release)
      ? dropTarget({
          key: `cell:${column.task.id}:${release.id}`,
          accepts: is(ITEM_KIND.STORY),
          move: (dragged) => (doc) =>
            moveStory(doc, dragged.id, { taskId: column.task.id, release: release.id }),
        })
      : {};

  const storyProps = (column, release, cellStories) => (story) => {
    if (story.id == null) return {};
    const drag = draggable({ kind: ITEM_KIND.STORY, id: story.id });
    if (!canDropStories(column, release)) return drag;
    return {
      ...drag,
      ...dropTarget({
        key: `story:${story.id}`,
        accepts: is(ITEM_KIND.STORY),
        axis: () => "y",
        move: (dragged, after) => (doc) =>
          moveStory(doc, dragged.id, {
            taskId: column.task.id,
            release: release.id,
            beforeId: after
              ? nextAfter(
                  cellStories.map((s) => s.story.id),
                  story.id,
                )
              : story.id,
          }),
      }),
    };
  };

  function storiesIn(column, release) {
    return stories.filter(
      ({ story, activityIndex, taskIndex }) =>
        activityIndex === column.activityIndex &&
        taskIndex === column.taskIndex &&
        (release === UNASSIGNED ? !knownReleases.has(story.release) : story.release === release.id),
    );
  }

  return (
    <>
      <div className="toolbar">
        <button className="add" onClick={() => onEdit({ kind: EDIT_KIND.ACTIVITY })}>
          + Activity
        </button>
        <button className="add" onClick={() => onEdit({ kind: EDIT_KIND.RELEASE })}>
          + Release
        </button>
      </div>
      {columns.length === 0 && <p>This story map is empty: add an activity to start.</p>}
      {columns.length > 0 && (
        <div className="map">
          <div className="grid" style={{ gridTemplateColumns: columns.map(columnWidth).join(" ") }}>
            {activities.map((activity, activityIndex) => {
              const key = foldKey.activity(activity, activityIndex);
              return (
                <ActivityHeader
                  key={key}
                  activity={activity}
                  activityIndex={activityIndex}
                  span={columns.filter((c) => c.activityIndex === activityIndex).length}
                  folded={isFolded(key)}
                  onToggle={() => toggle(key)}
                  onEdit={onEdit}
                  rootProps={activityProps(activity)}
                />
              );
            })}
            {columns.map((column) => (
              <TaskHeader
                key={column.key}
                column={column}
                onToggle={column.foldKey && (() => toggle(column.foldKey))}
                onEdit={onEdit}
                rootProps={taskProps(column)}
              />
            ))}
            {rows.map((release) => {
              const key = foldKey.release(release);
              const folded = isFolded(key);
              return (
                <Fragment key={release.releaseIndex ?? release.id}>
                  <ReleaseBand
                    release={release}
                    folded={folded}
                    onToggle={() => toggle(key)}
                    onEdit={onEdit}
                    rootProps={releaseProps(release)}
                  />
                  {!folded &&
                    columns.map((column) => {
                      const cellStories = storiesIn(column, release);
                      return (
                        <Cell
                          key={column.key}
                          column={column}
                          release={release}
                          stories={cellStories}
                          onEdit={onEdit}
                          rootProps={cellProps(column, release)}
                          storyProps={storyProps(column, release, cellStories)}
                        />
                      );
                    })}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
