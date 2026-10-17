import { expect, it } from "vitest";
import { STATUSES } from "./domain/storyMap.js";
import { STATUS_COLORS, statusColor } from "./statusColors.js";

it("has a color for every status of the schema, and only those", () => {
  expect(Object.keys(STATUS_COLORS).sort()).toEqual([...STATUSES].sort());
});

it("falls back to the border color for an unknown status", () => {
  expect(statusColor("Blocked")).toBe("var(--border)");
});
