import { Fragment } from "react";
import { EDIT_KIND } from "../editTargets.js";
import { UNASSIGNED, buildLayout } from "../mapLayout.js";
import { statusColor } from "../statusColors.js";

function StoryCard({ story, onClick }) {
  const style = { "--status-color": statusColor(story.status) };
  return (
    <button className="block story" style={style} onClick={onClick}>
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
        <div>
          <strong>{release.title}</strong>
          <div className="goal">{release.goal}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="release">
      <button
        className="block title"
        onClick={() =>
          onEdit({ kind: EDIT_KIND.RELEASE, releaseIndex: release.releaseIndex, id: release.id })
        }
      >
        <strong>{release.title}</strong>
        <span className="tag">{release.id}</span>
        <div className="goal">{release.goal}</div>
      </button>
    </div>
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

function ActivityHeader({ activity, activityIndex, span, onEdit }) {
  return (
    <div className="activity" style={{ gridColumn: `span ${span}` }}>
      <button
        className="block title"
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
  if (!task) {
    return <div className="task empty">No task yet</div>;
  }
  return (
    <div className="task">
      <button
        className="block title"
        onClick={() => onEdit({ kind: EDIT_KIND.TASK, activityIndex, taskIndex, id: task.id })}
      >
        {task.title}
      </button>
    </div>
  );
}

export default function StoryMap({ storyMap, onEdit }) {
  const { activities, columns, rows, storiesIn } = buildLayout(storyMap);

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
                span={columns.filter((c) => c.activityIndex === activityIndex).length}
                onEdit={onEdit}
              />
            ))}
            {columns.map((column) => (
              <TaskHeader key={column.key} column={column} onEdit={onEdit} />
            ))}
            {rows.map((row) => (
              <Fragment key={row.releaseIndex ?? row.id}>
                <ReleaseBand release={row} onEdit={onEdit} />
                {columns.map((column) => (
                  <Cell
                    key={column.key}
                    column={column}
                    release={row}
                    stories={storiesIn(column, row)}
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
