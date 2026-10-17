# Using the editor

Open it online at <https://ekinoxio.github.io/story-map-as-yaml/editor/>, or open
`editor/dist/index.html` from a clone of the repository directly in your browser: no install,
no build, no server. Either way, story maps are read from and saved to your own computer, never
uploaded. [Back to the README](../README.md)

## Starting a map

The start screen offers three ways in:

- **Open a story map file:** pick it, or drop it on the page.
- **Start from the sample:** an online bookstore, to see what a complete map looks like.
- **Start blank:** an empty map to fill in.

A map started from the sample or blank lives in the page until you save it: *Save as…* in
Chrome and Edge (editing then continues in that file), *Download YAML* elsewhere. *Close* (top
right) goes back to the start screen, asking first if changes are not saved.

## Staying in sync with the file

Chrome and Edge give the editor live access to the file you open:

- every add, edit, move and delete is saved straight into the file, keeping comments, quoting
  and key order: only the edited lines and `last_updated` change;
- the editor checks the file every second, and when it changed elsewhere (an AI agent, another
  editor, a `git pull`) the map updates on its own. An edit dialog left open keeps working on
  the right item, and closes if that item was deleted;
- if the file changed on disk since the editor last read it, a save is refused rather than
  overwriting the other change: the map reloads, and you redo your edit;
- while the file is being rewritten and is briefly not valid YAML, the editor keeps showing the
  last valid map.

Firefox and Safari cannot write local files: they open a one-time copy, so use *Download YAML*
to save your edits, and open the file again to see changes made elsewhere.

## Editing

Click the title, a release, an activity, a task or a story to edit it; the **+** buttons add
them, and deletes ask for confirmation. A new story gets the next free id (e.g. `US-405`),
which you can change; the id of an existing story can be edited too. Story ids must look like
`US-123` (the schema's pattern) and be unique.

Inconsistencies the schema cannot catch, such as duplicate ids or a story whose release does
not exist, show as a warning above the map.

## Folding

Use the ▾ / ▸ toggles to fold:

- a release: only its title and id stay; its goal and stories are hidden;
- a task: its title stays in a narrow column, and its stories show only their id, so you
  still see how many there are;
- an activity: its title stays over one narrow empty block per task, so you still see how
  many tasks it has; their titles and all their stories are hidden.

Folding only changes the view: nothing is written to the file, and folded items stay folded
when the file reloads.

## Reordering

Drag and drop to reorder, and the file is saved like any other edit:

- releases: up or down;
- activities: left or right;
- tasks: within their activity or into another one (drop on a task, or on an activity's
  title to put the task last);
- stories: within their cell, or into another task and/or release (dropping into another
  release row changes the story's release).

Comments attached to a moved item move with it, and dropping an item where it already is
changes nothing.

From the keyboard, focus an item (Tab) and press **Alt + arrow keys**: releases and stories
move up and down (a story at the edge of its cell goes to the next release row), activities,
tasks and stories move left and right (a task at the edge of its activity goes to the next
activity). Drag and drop was built for Chrome and Edge, and is untested in Firefox and Safari.
