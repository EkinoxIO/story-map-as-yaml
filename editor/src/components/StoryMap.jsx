import { Fragment } from "react";
import { EDIT_KIND } from "../editTargets.js";
import { UNASSIGNED, buildLayout, columnWidth } from "../mapLayout.js";
import { statusColor } from "../statusColors.js";
import useFolding from "../useFolding.js";

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
        className="block title"
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
function ActivityHeader(props) {
  const { activity, activityIndex, span, folded, onToggle, onEdit } = props;
  return (
    <div className="activity" style={{ gridColumn: `span ${span}` }}>
      <FoldToggle folded={folded} label={`activity ${activity.title}`} onToggle={onToggle} />
      <button
        className="block title"
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
  if (!task) {
    return <div className="task empty">No task yet</div>;
  }
  return (
    <div className="task">
      <FoldToggle folded={column.taskFolded} label={`task ${task.title}`} onToggle={onToggle} />
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
  const { isFolded, toggle } = useFolding();
  const layout = buildLayout(storyMap, isFolded);
  const { activities, columns, rows, storiesIn } = layout;

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
            {activities.map((activity, activityIndex) => (
              <ActivityHeader
                key={activity.foldKey}
                activity={activity}
                activityIndex={activityIndex}
                span={columns.filter((c) => c.activityIndex === activityIndex).length}
                folded={activity.folded}
                onToggle={() => toggle(activity.foldKey)}
                onEdit={onEdit}
              />
            ))}
            {columns.map((column) => (
              <TaskHeader
                key={column.key}
                column={column}
                onToggle={column.foldKey && (() => toggle(column.foldKey))}
                onEdit={onEdit}
              />
            ))}
            {rows.map((row) => {
              // Every row carries its fold key. Releases carry their fold state too; the
              // Unassigned row is not a release, so its state is read here.
              const key = row.foldKey;
              const folded = row.folded ?? isFolded(key);
              return (
                <Fragment key={row.releaseIndex ?? row.id}>
                  <ReleaseBand
                    release={row}
                    folded={folded}
                    onToggle={() => toggle(key)}
                    onEdit={onEdit}
                  />
                  {!folded &&
                    columns.map((column) => {
                      const cellStories = storiesIn(column, row);
                      return (
                        <Cell
                          key={column.key}
                          column={column}
                          release={row}
                          stories={cellStories}
                          onEdit={onEdit}
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
