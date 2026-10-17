import { useState } from "react";

// The browser builds its drag image from the dragged element only. When that element is a
// title inside an element marked `data-drag-image` (a header, a band), the whole marked
// element is shown instead, grabbed at the point where the pointer was. Browsers without
// setDragImage keep their default image.
function setWholeItemDragImage(e) {
  const item = e.currentTarget.parentElement?.closest("[data-drag-image]");
  if (!item || !e.dataTransfer.setDragImage) return;
  const box = item.getBoundingClientRect();
  e.dataTransfer.setDragImage(item, e.clientX - box.left, e.clientY - box.top);
}

// Drag and drop with the browser's native events. What is being dragged ({ kind, id }) is kept
// in state; the browser's dataTransfer only carries the id as text, which some browsers need.
//
//   draggable(item)            props for an element that can be dragged; inside an element
//                              marked data-drag-image, that whole element is the drag image
//   dropTarget(options)        props for an element that accepts drops:
//     key                      identifies the target, to highlight it while hovered
//     accepts(dragged)         whether this target takes the dragged item
//     axis(dragged)            "x" or "y" to drop before/after the target, null to drop into it
//     move(dragged, after)     the domain mutation to run, or null for none
//
// `onMove(mutate)` receives the mutation on drop.
export default function useDragAndDrop(onMove) {
  const [dragged, setDragged] = useState(null);
  const [hint, setHint] = useState(null); // { key, position: "before" | "after" | "into" }

  function reset() {
    setDragged(null);
    setHint(null);
  }

  function draggable(item) {
    return {
      draggable: true,
      "data-dragging": dragged?.kind === item.kind && dragged.id === item.id ? "" : undefined,
      onDragStart: (e) => {
        e.stopPropagation(); // a story card sits inside a cell: only the card is dragged
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        setWholeItemDragImage(e);
        setDragged(item);
      },
      onDragEnd: reset,
    };
  }

  function dropTarget({ key, accepts, axis = () => null, move }) {
    const active = dragged && accepts(dragged);
    function position(e) {
      const direction = axis(dragged);
      if (!direction) return "into";
      const box = e.currentTarget.getBoundingClientRect();
      const after =
        direction === "x"
          ? e.clientX > box.left + box.width / 2
          : e.clientY > box.top + box.height / 2;
      return after ? "after" : "before";
    }
    return {
      "data-drop": hint?.key === key ? hint.position : undefined,
      onDragOver: (e) => {
        if (!active) return;
        e.preventDefault(); // allows the drop
        e.stopPropagation(); // the innermost target wins
        const at = position(e);
        if (hint?.key !== key || hint.position !== at) setHint({ key, position: at });
      },
      onDragLeave: (e) => {
        if (hint?.key === key && !e.currentTarget.contains(e.relatedTarget)) setHint(null);
      },
      onDrop: (e) => {
        if (!active) return;
        e.preventDefault();
        e.stopPropagation();
        const mutate = move(dragged, position(e) === "after");
        reset();
        if (mutate) onMove(mutate);
      },
    };
  }

  return { draggable, dropTarget };
}
