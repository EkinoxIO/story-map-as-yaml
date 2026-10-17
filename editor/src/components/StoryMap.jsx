import { Fragment } from "react";
import { allStories } from "../domain/storyMap.js";
import { EDIT_KIND } from "../editTargets.js";
import { statusColor } from "../statusColors.js";
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
function StoryCard({ story, compact, onClick }) {
  const style = { "--status-color": statusColor(story.status) };
  if (compact) {
    return (
      <button className="block story compact" style={style} title={story.id} onClick={onClick}>
        <div className="id">{story.id}</div>
      </button>
    );
  }
  return (
    <button className="block story" style={style} onClick={onClick}>
      <div className="id">{story.id}</div>
      <div>{story.title}</div>
      <div className="tags">{story.status && <span className="tag">{story.status}</span>}</div>
    </button>
  );
}

// A folded release keeps its title and id; its goal and stories are hidden.
function ReleaseBand({ release, folded, onToggle, onEdit }) {
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
    <div className="release">
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

function Cell({ column, release, stories, onEdit }) {
  // Nothing shows under a folded activity.
  if (column.activityFolded) return <div className="cell" />;
  const { activityIndex, taskIndex, taskFolded } = column;
  return (
    <div className="cell">
      {stories.map(({ story, storyIndex }) => (
        <StoryCard
          key={story.id ?? storyIndex}
          story={story}
          compact={taskFolded}
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
function ActivityHeader({ activity, activityIndex, span, folded, onToggle, onEdit }) {
  return (
    <div className="activity" style={{ gridColumn: `span ${span}` }}>
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
function TaskHeader({ column, onToggle, onEdit }) {
  const { activityIndex, taskIndex, task } = column;
  if (column.activityFolded) return <div className="task placeholder" aria-hidden="true" />;
  if (!task) return <div className="task empty">No task yet</div>;
  return (
    <div className="task">
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

export default function StoryMap({ storyMap, onEdit }) {
  const { isFolded, toggle } = useFolding();
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
                />
              );
            })}
            {columns.map((column) => (
              <TaskHeader
                key={column.key}
                column={column}
                onToggle={column.foldKey && (() => toggle(column.foldKey))}
                onEdit={onEdit}
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
                  />
                  {!folded &&
                    columns.map((column) => (
                      <Cell
                        key={column.key}
                        column={column}
                        release={release}
                        stories={storiesIn(column, release)}
                        onEdit={onEdit}
                      />
                    ))}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
