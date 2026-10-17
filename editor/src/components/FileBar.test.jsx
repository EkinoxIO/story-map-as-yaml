// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FileBar from "./FileBar.jsx";

afterEach(cleanup);

function renderBar(props = {}) {
  const handlers = { onSaveAs: vi.fn(), onDownload: vi.fn(), onClose: vi.fn() };
  const all = {
    name: "map.yml",
    writable: false,
    unsaved: true,
    revision: 1,
    ...handlers,
    ...props,
  };
  const view = render(<FileBar {...all} />);
  return {
    ...handlers,
    rerender: (next) => view.rerender(<FileBar {...all} {...next} />),
  };
}

const closeButton = () => screen.getByRole("button", { name: /Close|Discard unsaved changes/ });

describe("FileBar", () => {
  it("closes at once when everything is saved", () => {
    const { onClose } = renderBar({ writable: true, unsaved: false });
    fireEvent.click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks before closing with unsaved changes, then closes on the second click", () => {
    const { onClose } = renderBar();
    fireEvent.click(closeButton());
    expect(closeButton().textContent).toBe("Discard unsaved changes?");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disarms the confirmation when the map changes", () => {
    const { onClose, rerender } = renderBar();
    fireEvent.click(closeButton());
    rerender({ revision: 2 });
    expect(closeButton().textContent).toBe("Close");
    fireEvent.click(closeButton());
    expect(onClose).not.toHaveBeenCalled(); // asks again
  });

  it("disarms the confirmation once the changes are saved", () => {
    const { rerender } = renderBar();
    fireEvent.click(closeButton());
    rerender({ unsaved: false });
    expect(closeButton().textContent).toBe("Close");
  });

  it("disarms the confirmation when the button loses focus", () => {
    renderBar();
    fireEvent.click(closeButton());
    fireEvent.blur(closeButton());
    expect(closeButton().textContent).toBe("Close");
  });

  it("offers Download YAML when the browser cannot save as", () => {
    const { onDownload } = renderBar({ inMemory: true });
    fireEvent.click(screen.getByRole("button", { name: "Download YAML" }));
    expect(onDownload).toHaveBeenCalled();
    expect(screen.getByText(/not saved to a file yet/)).toBeTruthy();
  });
});
