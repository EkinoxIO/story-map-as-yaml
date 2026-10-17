// Accent color of a story card per status. A test checks that every status of the schema
// has a color; a status this map does not know gets the neutral border color.
export const STATUS_COLORS = {
  Backlog: "#8c959f",
  "In Progress": "#bf8700",
  "In Review": "#0969da",
  Done: "#1a7f37",
};

export function statusColor(status) {
  return STATUS_COLORS[status] ?? "var(--border)";
}
