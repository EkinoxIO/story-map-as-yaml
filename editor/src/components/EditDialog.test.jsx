// @vitest-environment jsdom
import "../test/dialogPolyfill.js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryMapError } from "../domain/storyMap.js";
import EditDialog from "./EditDialog.jsx";

afterEach(cleanup);

const FIELDS = [
  { name: "title", label: "Title", required: true },
  { name: "status", label: "Status", options: ["Backlog", "Done"] },
];

function renderDialog(props = {}) {
  const handlers = { onSave: vi.fn(), onClose: vi.fn(), ...props };
  render(
    <EditDialog
      title="Edit US-1"
      fields={FIELDS}
      initial={{ title: "Email", status: "Done" }}
      {...handlers}
    />,
  );
  return handlers;
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("EditDialog", () => {
  it("opens with the initial values", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Edit US-1" })).toBeTruthy();
    expect(screen.getByLabelText("Title").value).toBe("Email");
    expect(screen.getByLabelText("Status").value).toBe("Done");
  });

  it("saves the edited values, trimmed, then closes", () => {
    const { onSave, onClose } = renderDialog();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  Email sign up  " } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Backlog" } });
    save();
    expect(onSave).toHaveBeenCalledWith({ title: "Email sign up", status: "Backlog" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a rule violation and stays open", () => {
    const onSave = vi.fn(() => {
      throw new StoryMapError("The title cannot be empty.");
    });
    const { onClose } = renderDialog({ onSave });
    save();
    expect(screen.getByText("The title cannot be empty.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not hide unexpected errors", () => {
    // React reports errors thrown by event handlers to window instead of rethrowing them.
    const reported = [];
    const listener = (event) => {
      reported.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", listener);
    const onSave = vi.fn(() => {
      throw new TypeError("bug");
    });
    const { onClose } = renderDialog({ onSave });
    save();
    window.removeEventListener("error", listener);
    expect(reported.map((e) => e.message)).toEqual(["bug"]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels without saving", () => {
    const { onSave, onClose } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has no Delete button when the item cannot be deleted", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("asks for confirmation before deleting", () => {
    const onDelete = vi.fn();
    const { onClose } = renderDialog({ onDelete, deleteConfirmation: 'Delete US-1 "Email"?' });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText('Delete US-1 "Email"?')).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows why a delete is refused and stays open", () => {
    const onDelete = vi.fn(() => {
      throw new StoryMapError("Release MVP still has 1 story: move or delete them first.");
    });
    const { onClose } = renderDialog({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/still has 1 story/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
