import { useState } from "react";

/** Which items are folded: `isFolded(key)` and `toggle(key)`, with keys from folding.js. */
export default function useFolding() {
  const [folded, setFolded] = useState(() => new Set());
  return {
    isFolded: (key) => folded.has(key),
    toggle: (key) =>
      setFolded((current) => {
        const next = new Set(current);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
  };
}
