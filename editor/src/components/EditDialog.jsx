import { useEffect, useRef, useState } from "react";
import { StoryMapError } from "../domain/storyMap.js";

// Modal form. onSave(values) and onDelete() may throw a StoryMapError: its message is shown
// and the dialog stays open; any other outcome closes it. When deleteConfirmation is given,
// the first click on Delete shows it and a second click deletes.
export default function EditDialog({
  title,
  fields,
  initial,
  onSave,
  onDelete,
  deleteConfirmation,
  onClose,
}) {
  const ref = useRef(null);
  const [values, setValues] = useState(initial);
  const [problem, setProblem] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // StrictMode runs effects twice in development: only open the dialog once.
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
  }, []);

  function run(action) {
    try {
      action();
      onClose();
    } catch (e) {
      if (!(e instanceof StoryMapError)) throw e;
      setProblem(e.message);
    }
  }

  function submit(e) {
    e.preventDefault();
    const trimmed = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );
    run(() => onSave(trimmed));
  }

  function remove() {
    if (deleteConfirmation && !confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    run(onDelete);
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{title}</h2>
        {fields.map((field, index) => {
          const props = {
            value: values[field.name] ?? "",
            onChange: (e) => setValues((current) => ({ ...current, [field.name]: e.target.value })),
            required: field.required,
            autoFocus: index === 0,
          };
          return (
            <label key={field.name}>
              {field.label}
              {field.options ? (
                <select {...props}>
                  {field.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : field.multiline ? (
                <textarea rows={3} {...props} />
              ) : (
                <input {...props} />
              )}
            </label>
          );
        })}
        {confirmingDelete && !problem && <p className="problem">{deleteConfirmation}</p>}
        {problem && <p className="problem">{problem}</p>}
        <div className="actions">
          {onDelete && (
            <button type="button" className="danger" onClick={remove}>
              {confirmingDelete ? "Confirm delete" : "Delete"}
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
