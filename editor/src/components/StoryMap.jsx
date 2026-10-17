import { Fragment, useEffect, useRef } from "react";
import { ITEM_KIND } from "../domain/storyMap.js";
import { EDIT_KIND } from "../editTargets.js";
import { UNASSIGNED, buildLayout, columnWidth } from "../mapLayout.js";
import { canDropStories, drop, isMoveKey, keyboardMove } from "../mapMoves.js";
import { statusColor } from "../statusColors.js";
import useDragAndDrop from "../useDragAndDrop.js";
import useFolding from "../useFolding.js";
import Clickable from "./Clickable.jsx";

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
function StoryCard({ story, compact, onActivate, itemProps }) {
  const style = { "--status-color": statusColor(story.status) };
  if (compact) {
    return (
      <Clickable
        className="story compact"
        style={style}
        title={story.id}
        onActivate={onActivate}
        {...itemProps}
      >
        <div className="id">{story.id}</div>
      </Clickable>
    );
  }
  return (
    <Clickable className="story" style={style} onActivate={onActivate} {...itemProps}>
      <div className="id">{story.id}</div>
      <div>{story.title}</div>
      <div className="tags">{story.status && <span className="tag">{story.status}</span>}</div>
    </Clickable>
  );
}

// Headers and bands are dragged by their title; `data-drag-image` makes the browser show the
// whole header or band, background included, while it is dragged (see useDragAndDrop).

// A folded release keeps its title and id; its goal and stories are hidden.
function ReleaseBand({ release, folded, onToggle, onEdit, rootProps, itemProps }) {
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
    <div className="release" data-drag-image {...rootProps}>
      {toggle}
      <Clickable
        className="title"
        onActivate={() =>
          onEdit({ kind: EDIT_KIND.RELEASE, releaseIndex: release.releaseIndex, id: release.id })
        }
        {...itemProps}
      >
        <strong>{release.title}</strong>
        <span className="tag">{release.id}</span>
        {!folded && <div className="goal">{release.goal}</div>}
      </Clickable>
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
          itemProps={storyProps(story)}
          onActivate={() =>
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
  const { activity, activityIndex, span, folded, onToggle, onEdit, rootProps, itemProps } = props;
  return (
    <div className="activity" data-drag-image style={{ gridColumn: `span ${span}` }} {...rootProps}>
      <FoldToggle folded={folded} label={`activity ${activity.title}`} onToggle={onToggle} />
      <Clickable
        className="title"
        onActivate={() => onEdit({ kind: EDIT_KIND.ACTIVITY, activityIndex, id: activity.id })}
        {...itemProps}
      >
        {activity.title}
      </Clickable>
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
function TaskHeader({ column, onToggle, onEdit, rootProps, itemProps }) {
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
    <div className="task" data-drag-image {...rootProps}>
      <FoldToggle folded={column.taskFolded} label={`task ${task.title}`} onToggle={onToggle} />
      <Clickable
        className="title"
        onActivate={() => onEdit({ kind: EDIT_KIND.TASK, activityIndex, taskIndex, id: task.id })}
        {...itemProps}
      >
        {task.title}
      </Clickable>
    </div>
  );
}

const itemKey = (item) => `${item.kind}:${item.id}`;

export default function StoryMap({ storyMap, onEdit, onMove }) {
  const { isFolded, toggle } = useFolding();
  const { draggable, dropTarget } = useDragAndDrop(onMove);
  const layout = buildLayout(storyMap, isFolded);
  const { activities, columns, rows, storiesIn } = layout;
  const is = (kind) => (dragged) => dragged.kind === kind;

  // After a keyboard move, the moved item gets the focus back once the map has re-rendered.
  const focusAfterMove = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    if (!focusAfterMove.current) return;
    mapRef.current?.querySelector(`[data-item="${focusAfterMove.current}"]`)?.focus();
    focusAfterMove.current = null;
  });

  // Props for the focusable part of a movable item: it is dragged, and Alt + arrows move it.
  function movable(item) {
    if (item.id == null) return {};
    return {
      ...draggable({ kind: item.kind, id: item.id }),
      "data-item": itemKey(item),
      "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight",
      onKeyDown: (e) => {
        if (!isMoveKey(e)) return;
        e.preventDefault();
        const mutate = keyboardMove(layout, item, e.key);
        if (!mutate) return;
        focusAfterMove.current = itemKey(item);
        onMove(mutate);
      },
    };
  }

  // Drop targets: what each part of the map takes, and which move a drop runs.
  const releaseDrop = (release) =>
    release === UNASSIGNED || release.id == null
      ? {}
      : dropTarget({
          key: `release:${release.id}`,
          accepts: is(ITEM_KIND.RELEASE),
          axis: () => "y",
          move: (dragged, after) => drop.release(layout, release, dragged.id, after),
        });

  const activityDrop = (activity) =>
    activity.id == null
      ? {}
      : dropTarget({
          key: `activity:${activity.id}`,
          accepts: (dragged) => is(ITEM_KIND.ACTIVITY)(dragged) || is(ITEM_KIND.TASK)(dragged),
          axis: (dragged) => (is(ITEM_KIND.ACTIVITY)(dragged) ? "x" : null),
          move: (dragged, after) => drop.activity(layout, activity, dragged, after),
        });

  const taskDrop = (column) => {
    const activity = activities[column.activityIndex];
    if (activity.id == null) return {};
    if (!column.task) {
      return dropTarget({
        key: `empty:${activity.id}`,
        accepts: is(ITEM_KIND.TASK),
        move: (dragged) => drop.emptyActivity(activity, dragged.id),
      });
    }
    if (column.task.id == null) return {};
    return dropTarget({
      key: `task:${column.task.id}`,
      accepts: is(ITEM_KIND.TASK),
      axis: () => "x",
      move: (dragged, after) => drop.task(layout, column, dragged.id, after),
    });
  };

  const cellDrop = (column, row) =>
    canDropStories(column, row)
      ? dropTarget({
          key: `cell:${column.task.id}:${row.id}`,
          accepts: is(ITEM_KIND.STORY),
          move: (dragged) => drop.cell(column, row, dragged.id),
        })
      : {};

  const storyProps = (column, row, cellStories) => (story) => {
    const props = movable({ kind: ITEM_KIND.STORY, id: story.id, column, row });
    if (story.id == null || !canDropStories(column, row)) return props;
    return {
      ...props,
      ...dropTarget({
        key: `story:${story.id}`,
        accepts: is(ITEM_KIND.STORY),
        axis: () => "y",
        move: (dragged, after) => drop.story(column, row, cellStories, story, dragged.id, after),
      }),
    };
  };

  return (
    <>
      <div className="toolbar">
        <button className="add" onClick={() => onEdit({ kind: EDIT_KIND.ACTIVITY })}>
          + Activity
        </button>
        <button className="add" onClick={() => onEdit({ kind: EDIT_KIND.RELEASE })}>
          + Release
        </button>
        <span className="hint">Drag to reorder, or Alt + arrow keys on a focused item.</span>
      </div>
      {columns.length === 0 && <p>This story map is empty: add an activity to start.</p>}
      {columns.length > 0 && (
        <div className="map" ref={mapRef}>
          <div className="grid" style={{ gridTemplateColumns: columns.map(columnWidth).join(" ") }}>
            {activities.map((activity, activityIndex) => {
              const key = activity.foldKey;
              return (
                <ActivityHeader
                  key={key}
                  activity={activity}
                  activityIndex={activityIndex}
                  span={columns.filter((c) => c.activityIndex === activityIndex).length}
                  folded={activity.folded}
                  onToggle={() => toggle(key)}
                  onEdit={onEdit}
                  rootProps={activityDrop(activity)}
                  itemProps={movable({ kind: ITEM_KIND.ACTIVITY, id: activity.id })}
                />
              );
            })}
            {columns.map((column) => (
              <TaskHeader
                key={column.key}
                column={column}
                onToggle={column.foldKey && (() => toggle(column.foldKey))}
                onEdit={onEdit}
                rootProps={taskDrop(column)}
                itemProps={
                  column.task && movable({ kind: ITEM_KIND.TASK, id: column.task.id, column })
                }
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
                    rootProps={releaseDrop(row)}
                    itemProps={movable({ kind: ITEM_KIND.RELEASE, id: row.id })}
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
                          rootProps={cellDrop(column, row)}
                          storyProps={storyProps(column, row, cellStories)}
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
