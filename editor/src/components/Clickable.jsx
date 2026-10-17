// A clickable element that is not a <button>: Firefox does not start a drag from a button,
// so the parts of the map that can be dragged use this instead. It behaves like a button for
// keyboard and screen-reader users: focusable, role "button", Enter or Space activates it.
export default function Clickable({ onActivate, onKeyDown, children, ...props }) {
  function keyDown(e) {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onActivate();
      return;
    }
    onKeyDown?.(e);
  }
  return (
    <div role="button" tabIndex={0} onClick={onActivate} onKeyDown={keyDown} {...props}>
      {children}
    </div>
  );
}
