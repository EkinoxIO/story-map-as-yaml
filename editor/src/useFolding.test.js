// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { foldKey } from "./folding.js";
import useFolding from "./useFolding.js";

describe("foldKey", () => {
  it("keys items by id", () => {
    expect(foldKey.activity({ id: "act_1" }, 3)).toBe("activity:act_1");
    expect(foldKey.task({ id: "task_2" }, 0, 1)).toBe("task:task_2");
    expect(foldKey.release({ id: "MVP" })).toBe("release:MVP");
  });

  it("falls back to the position for items without an id", () => {
    expect(foldKey.activity({}, 3)).toBe("activity:3");
    expect(foldKey.task({}, 0, 1)).toBe("task:0-1");
  });

  it("never mixes kinds that share an id", () => {
    expect(foldKey.activity({ id: "x" }, 0)).not.toBe(foldKey.task({ id: "x" }, 0, 0));
  });
});

describe("useFolding", () => {
  it("starts with nothing folded", () => {
    const { result } = renderHook(() => useFolding());
    expect(result.current.isFolded("task:task_1")).toBe(false);
  });

  it("folds and unfolds one key without touching the others", () => {
    const { result } = renderHook(() => useFolding());
    act(() => result.current.toggle("task:task_1"));
    expect(result.current.isFolded("task:task_1")).toBe(true);
    expect(result.current.isFolded("task:task_2")).toBe(false);
    act(() => result.current.toggle("task:task_1"));
    expect(result.current.isFolded("task:task_1")).toBe(false);
  });

  it("applies two toggles made before a re-render", () => {
    const { result } = renderHook(() => useFolding());
    act(() => {
      result.current.toggle("release:MVP");
      result.current.toggle("activity:act_1");
    });
    expect(result.current.isFolded("release:MVP")).toBe(true);
    expect(result.current.isFolded("activity:act_1")).toBe(true);
  });
});
