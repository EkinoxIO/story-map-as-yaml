// Low-level helpers on yaml nodes, shared by the operations and the moves. Not exported by
// the domain: callers use the operations.
import { isSeq } from "yaml";

// Inserts a node at `index` in the sequence at `path`, creating the sequence when it is
// missing or null (`stories:`). An empty flow sequence (`stories: []`) becomes a block one,
// so items are written one per line like the rest of the file.
export function insertNode(doc, path, index, node) {
  let seq = doc.getIn(path);
  if (!isSeq(seq)) {
    doc.setIn(path, doc.createNode([]));
    seq = doc.getIn(path);
  }
  if (seq.items.length === 0) seq.flow = false;
  const at = Math.min(index, seq.items.length);
  // The first item is about to lose its place: it takes the sequence's comment along.
  if (at === 0 && seq.items.length) giveSequenceCommentTo(seq, seq.items[0]);
  seq.items.splice(at, 0, node);
}

// The yaml library keeps a comment written above the first item of a sequence on the sequence
// itself. When that item leaves first place (moved away, or another one inserted before it),
// the comment goes with the item it was written for.
export function giveSequenceCommentTo(seq, node) {
  if (!seq.commentBefore) return;
  node.commentBefore = joinComments(seq.commentBefore, node.commentBefore);
  seq.commentBefore = undefined;
}

function joinComments(...comments) {
  return comments.filter(Boolean).join("\n") || undefined;
}

export function append(doc, path, value) {
  insertNode(doc, path, Infinity, doc.createNode(value));
}

export function setFields(doc, path, fields) {
  for (const [key, value] of Object.entries(fields)) doc.setIn([...path, key], value);
}
