import { Fragment } from "react";
import { allStories } from "../domain/storyMap.js";
import { EDIT_KIND } from "../editTargets.js";
import { statusColor } from "../statusColors.js";

const UNASSIGNED = {
  id: "__unassigned__",
  title: "Unassigned",
  goal: "Stories whose release is not listed under `releases`.",
};

function StoryCard({ story, onClick }) {
  return (
    <button
      className="block story"
      style={{ "--status-color": statusColor(story.status) }}
      onClick={onClick}
    >
      <div className="id">{story.id}</div>
      <div>{story.title}</div>
      <div className="tags">{story.status && <span className="tag">{story.status}</span>}</div>
    </button>
  );
}

function ReleaseBand({ release, onEdit }) {
  if (release === UNASSIGNED) {
    return (
      <div className="release">
        <strong>{release.title}</strong>
        <div className="goal">{release.goal}</div>
      </div>
    );
  }
  return (
    <button
      className="block release"
      onClick={() =>
        onEdit({ kind: EDIT_KIND.RELEASE, releaseIndex: release.releaseIndex, id: release.id })
      }
    >
      <strong>{release.title}</strong>
      <span className="tag">{release.id}</span>
      <div className="goal">{release.goal}</div>
    </button>
  );
}

function Cell({ column, release, stories, onEdit }) {
  const { activityIndex, taskIndex } = column;
  return (
    <div className="cell">
      {stories.map(({ story, storyIndex }) => (
        <StoryCard
          key={story.id ?? storyIndex}
          story={story}
          onClick={() =>
            onEdit({ kind: EDIT_KIND.STORY, activityIndex, taskIndex, storyIndex, id: story.id })
          }
        />
      ))}
      {column.task && release !== UNASSIGNED && (
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

function ActivityHeader({ activity, activityIndex, onEdit }) {
  return (
    <div className="activity" style={{ gridColumn: `span ${(activity.tasks || []).length || 1}` }}>
      <button
        className="block"
        onClick={() => onEdit({ kind: EDIT_KIND.ACTIVITY, activityIndex, id: activity.id })}
      >
        {activity.title}
      </button>
      <button
        className="add"
        title="Add task"
        onClick={() => onEdit({ kind: EDIT_KIND.TASK, activityIndex, parentId: activity.id })}
      >
        +
      </button>
    </div>
  );
}

function TaskHeader({ column, onEdit }) {
  const { activityIndex, taskIndex, task } = column;
  if (!task) return <div className="task empty">No task yet</div>;
  return (
    <button
      className="block task"
      onClick={() => onEdit({ kind: EDIT_KIND.TASK, activityIndex, taskIndex, id: task.id })}
    >
      {task.title}
    </button>
  );
}

export default function StoryMap({ storyMap, onEdit }) {
  const activities = storyMap.activities || [];
  // One column per task. An activity without tasks still gets a column,
  // so it can be seen and filled.
  const columns = activities.flatMap((activity, activityIndex) =>
    (activity.tasks || []).length
      ? activity.tasks.map((task, taskIndex) => ({
          key: task.id ?? `${activityIndex}-${taskIndex}`,
          activityIndex,
          taskIndex,
          task,
        }))
      : [{ key: activity.id ?? activityIndex, activityIndex, taskIndex: null, task: null }],
  );
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
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${columns.length}, var(--col-width))` }}
          >
            {activities.map((activity, activityIndex) => (
              <ActivityHeader
                key={activity.id ?? activityIndex}
                activity={activity}
                activityIndex={activityIndex}
                onEdit={onEdit}
              />
            ))}
            {columns.map((column) => (
              <TaskHeader key={column.key} column={column} onEdit={onEdit} />
            ))}
            {rows.map((release) => (
              <Fragment key={release.releaseIndex ?? release.id}>
                <ReleaseBand release={release} onEdit={onEdit} />
                {columns.map((column) => (
                  <Cell
                    key={column.key}
                    column={column}
                    release={release}
                    stories={storiesIn(column, release)}
                    onEdit={onEdit}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
