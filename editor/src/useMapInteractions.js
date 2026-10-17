import { ITEM_KIND } from "./domain/storyMap.js";
import { UNASSIGNED } from "./mapLayout.js";
import { canDropStories, drop } from "./mapMoves.js";
import useDragAndDrop from "./useDragAndDrop.js";

const is = (kind) => (dragged) => dragged.kind === kind;

/**
 * How the items of the map are moved by drag and drop. Returns the props to spread on each
 * part of the map, so the map component only lays out the grid:
 * - movable(item): the draggable part of an item ({ kind, id })
 * - releaseDrop, activityDrop, taskDrop, cellDrop, storyProps: what each part takes when
 *   something is dropped on it, and which move the drop runs (see mapMoves.drop)
 */
export default function useMapInteractions(layout, onMove) {
  const { draggable, dropTarget } = useDragAndDrop(onMove);

  function movable(item) {
    if (item.id == null) return {};
    return draggable({ kind: item.kind, id: item.id });
  }

  const releaseDrop = (release) =>
    release === UNASSIGNED || release.id == null
      ? {}
      : dropTarget({
          key: `release:${release.id}`,
          accepts: is(ITEM_KIND.RELEASE),
          axis: () => "y",
          move: (dragged, after) => drop.release(layout, release, dragged, after),
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
    const activity = layout.activities[column.activityIndex];
    if (activity.id == null) return {};
    if (!column.task) {
      return dropTarget({
        key: `empty:${activity.id}`,
        accepts: is(ITEM_KIND.TASK),
        move: (dragged) => drop.emptyActivity(layout, activity, dragged),
      });
    }
    if (column.task.id == null) return {};
    return dropTarget({
      key: `task:${column.task.id}`,
      accepts: is(ITEM_KIND.TASK),
      axis: () => "x",
      move: (dragged, after) => drop.task(layout, column, dragged, after),
    });
  };

  const cellDrop = (column, row) =>
    canDropStories(column, row)
      ? dropTarget({
          key: `cell:${column.task.id}:${row.id}`,
          accepts: is(ITEM_KIND.STORY),
          move: (dragged) => drop.cell(layout, { column, row }, dragged),
        })
      : {};

  // A story card is both movable and a drop target for other stories.
  const storyProps = (column, row) => (story) => {
    const props = movable({ kind: ITEM_KIND.STORY, id: story.id, column, row });
    if (story.id == null || !canDropStories(column, row)) return props;
    return {
      ...props,
      ...dropTarget({
        key: `story:${story.id}`,
        accepts: is(ITEM_KIND.STORY),
        axis: () => "y",
        move: (dragged, after) => drop.story(layout, { column, row, story }, dragged, after),
      }),
    };
  };

  return { movable, releaseDrop, activityDrop, taskDrop, cellDrop, storyProps };
}
