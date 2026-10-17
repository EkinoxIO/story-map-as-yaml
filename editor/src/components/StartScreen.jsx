import FilePicker from "./FilePicker.jsx";

const EKINOX_URL = "https://ekinox.io";

// The first screen: open a story map file, or start from the sample or from a blank map.
// `onStart("sample" | "blank")` starts from one of the STARTING_POINTS.
export default function StartScreen({ onPick, onStart }) {
  return (
    <div className="start">
      <FilePicker onPick={onPick} />
      <div className="start-options">
        <button className="start-option" onClick={() => onStart("sample")}>
          <strong>Start from the sample</strong>
          <span>An online bookstore, to see what a complete story map looks like.</span>
        </button>
        <button className="start-option" onClick={() => onStart("blank")}>
          <strong>Start blank</strong>
          <span>An empty map: add releases, activities, tasks and stories.</span>
        </button>
      </div>
      <p className="start-note">
        A map started here lives in this page until you save it to a file.
      </p>
      <p className="by-ekinox">
        Story Map as YAML, by{" "}
        <a href={EKINOX_URL} target="_blank" rel="noreferrer">
          Ekinox
        </a>
      </p>
    </div>
  );
}
