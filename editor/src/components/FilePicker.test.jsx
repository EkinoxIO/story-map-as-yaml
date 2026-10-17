// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFileHandle } from "../test/fakeFileHandle.js";
import FilePicker from "./FilePicker.jsx";

const { handle: fileHandle } = fakeFileHandle("");
const folderHandle = { kind: "directory", name: "maps" };

beforeEach(() => {
  // A browser that hands out file handles (Chrome, Edge), as the file picker checks.
  window.showOpenFilePicker = async () => [fileHandle];
});

afterEach(() => {
  cleanup();
  delete window.showOpenFilePicker;
});

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
