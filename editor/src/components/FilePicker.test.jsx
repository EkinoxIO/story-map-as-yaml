// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const fileHandle = {
  kind: "file",
  name: "map.yml",
  getFile: async () => new File([""], "map.yml"),
};
const folderHandle = { kind: "directory", name: "maps" };

let FilePicker;
beforeAll(async () => {
  // The file picker decides at import time whether the browser can hand out file handles.
  window.showOpenFilePicker = async () => [fileHandle];
  FilePicker = (await import("./FilePicker.jsx")).default;
});

afterEach(cleanup);

// A drop whose single item resolves to `handle` (or fails with `error`).
function dropItem({ handle, error, kind = "file" }) {
  const item = {
    kind,
    getAsFileSystemHandle: () => (error ? Promise.reject(error) : Promise.resolve(handle)),
  };
  fireEvent.drop(screen.getByText("Open a story map").parentElement, {
    dataTransfer: { items: [item] },
  });
}

describe("FilePicker", () => {
  it("opens a file chosen in the picker", async () => {
    const onPick = vi.fn();
    render(<FilePicker onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose file" }));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(fileHandle));
  });

  it("opens a dropped file", async () => {
    const onPick = vi.fn();
    render(<FilePicker onPick={onPick} />);
    dropItem({ handle: fileHandle });
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(fileHandle));
  });

  it("refuses a dropped folder with a clear message", async () => {
    const onPick = vi.fn();
    render(<FilePicker onPick={onPick} />);
    dropItem({ handle: folderHandle });
    expect(await screen.findByText(/not a folder/)).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("refuses a drop that is not a file, such as dragged text", () => {
    const onPick = vi.fn();
    render(<FilePicker onPick={onPick} />);
    dropItem({ kind: "string" });
    expect(screen.getByText(/not a folder/)).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("reports a drop the browser could not open", async () => {
    render(<FilePicker onPick={vi.fn()} />);
    dropItem({ error: new Error("blocked") });
    expect(await screen.findByText("Could not open the file: blocked")).toBeTruthy();
  });
});
