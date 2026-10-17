// @vitest-environment jsdom
import "./test/dialogPolyfill.js";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const YAML = `title: "Bookstore"
releases:
  - { id: "MVP", title: "Walking Skeleton", goal: "Sell one book" }
activities:
  - id: act_1
    title: "Buy"
    tasks:
      - id: task_1
        title: "Pay"
        stories:
          - { id: US-1, title: "Pay by card", release: "MVP", status: "Done" }
          - id: US-2
            title: "Pay by gift card"
            release: "MVP"
            status: "Backlog"
`;

// In-memory stand-in for a FileSystemFileHandle, as returned by the browser's file picker.
const disk = { text: YAML, lastModified: 1 };
const handle = {
  kind: "file",
  name: "bookstore.yml",
  getFile: async () => new File([disk.text], "bookstore.yml", { lastModified: disk.lastModified }),
  queryPermission: async () => "granted",
  requestPermission: async () => "granted",
  createWritable: async () => {
    let buffer = "";
    return {
      write: async (chunk) => {
        buffer += chunk;
      },
      close: async () => {
        disk.text = buffer;
        disk.lastModified += 1;
      },
    };
  },
};

function changeOnDisk(text) {
  disk.text = text;
  disk.lastModified += 10;
}

let App;
beforeAll(async () => {
  // A browser that hands out file handles (Chrome, Edge), as the file picker checks.
  window.showOpenFilePicker = async () => [handle];
  App = (await import("./App.jsx")).default;
});

afterEach(() => {
  cleanup();
  disk.text = YAML;
  disk.lastModified = 1;
});

async function openFile() {
  // Poll fast so tests that wait for a reload do not depend on wall-clock margins.
  render(<App pollIntervalMs={20} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose file" }));
  await screen.findByText("Pay by card");
}

describe("starting without a file", () => {
  it("starts from the sample, not saved to a file yet", async () => {
    render(<App pollIntervalMs={20} />);
    fireEvent.click(screen.getByRole("button", { name: /Start from the sample/ }));
    expect(await screen.findByText("Online Bookstore Story Map")).toBeTruthy();
    expect(document.querySelectorAll(".story")).toHaveLength(27);
    expect(screen.getByText(/not saved to a file yet/)).toBeTruthy();
  });

  it("starts blank", async () => {
    render(<App pollIntervalMs={20} />);
    fireEvent.click(screen.getByRole("button", { name: /Start blank/ }));
    expect(await screen.findByText(/This story map is empty/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "New story map" })).toBeTruthy();
  });

  it("saves the map to a new file, then edits it there", async () => {
    let written = null;
    const newFile = {
      kind: "file",
      name: "my_map.yml",
      getFile: async () => new File([written ?? ""], "my_map.yml", { lastModified: 5 }),
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      createWritable: async () => ({
        write: async (text) => {
          written = text;
        },
        close: async () => {},
      }),
    };
    window.showSaveFilePicker = async () => newFile;
    render(<App pollIntervalMs={20} />);
    fireEvent.click(screen.getByRole("button", { name: /Start blank/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save as…" }));
    expect(await screen.findByText(/saved to file, watching for changes/)).toBeTruthy();
    expect(written).toContain('title: "New story map"');
    expect(screen.getByText(/my_map\.yml/)).toBeTruthy();
    delete window.showSaveFilePicker;
  });

  it("asks before closing a map that is not saved, then goes back to the start", async () => {
    render(<App pollIntervalMs={20} />);
    fireEvent.click(screen.getByRole("button", { name: /Start blank/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Discard unsaved changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard unsaved changes?" }));
    expect(screen.getByRole("button", { name: /Start from the sample/ })).toBeTruthy();
  });
});

describe("App", () => {
  it("closes a saved map at once, back to the start screen", async () => {
    await openFile();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: /Start blank/ })).toBeTruthy();
  });

  it("shows the story map from the chosen file", async () => {
    await openFile();
    expect(screen.getByRole("button", { name: "Bookstore" })).toBeTruthy();
    expect(screen.getByText(/saved to file, watching for changes/)).toBeTruthy();
    expect(screen.getByText("Walking Skeleton")).toBeTruthy();
  });

  it("saves an edit to the file", async () => {
    await openFile();
    fireEvent.click(screen.getByText("Pay by card"));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Pay by credit card" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(disk.text).toContain('title: "Pay by credit card"'));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("warns about stories whose release does not exist", async () => {
    await openFile();
    changeOnDisk(
      YAML.replace(
        'release: "MVP"\n            status: "Backlog"',
        'release: "v9"\n            status: "Backlog"',
      ),
    );
    expect(await screen.findByText('Story US-2 refers to unknown release "v9".')).toBeTruthy();
  });

  it("ignores a file dropped from outside onto an open map", async () => {
    await openFile();
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { types: ["Files"] } });
    window.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true); // the browser does not open the file instead
  });

  it("closes the dialog for good when its item is deleted on disk", async () => {
    await openFile();
    fireEvent.click(screen.getByText("Pay by card"));
    const heading = () => screen.queryByRole("heading", { name: "Edit US-1" });
    expect(heading()).toBeTruthy();

    changeOnDisk(YAML.replace(/ {10}- \{ id: US-1.*\n/, ""));
    await waitFor(() => expect(heading()).toBeNull());

    // The item comes back (e.g. an undo in another editor): the dialog must not reopen.
    changeOnDisk(YAML);
    await screen.findByText("Pay by card");
    expect(heading()).toBeNull();
  });
});
