// Consistency rules JSON Schema cannot express.
import { allStories } from "./lookups.js";

/**
 * Problems JSON Schema cannot express: duplicate ids, and stories whose release is not
 * listed under `releases`. Returns one user-facing message per problem; empty when consistent.
 */
export function checkReferences(storyMap) {
  const activities = storyMap.activities || [];
  const releases = storyMap.releases || [];
  const tasks = activities.flatMap((a) => a.tasks || []);
  const stories = allStories(storyMap).map(({ story }) => story);
  const problems = [];

  for (const [kind, items] of [
    ["release", releases],
    ["activity", activities],
    ["task", tasks],
    ["story", stories],
  ]) {
    const counts = new Map();
    for (const { id } of items) counts.set(id, (counts.get(id) || 0) + 1);
    for (const [id, count] of counts) {
      if (count > 1) problems.push(`Duplicate ${kind} id "${id}" (${count} times).`);
    }
  }

  const releaseIds = new Set(releases.map((r) => r.id));
  for (const story of stories) {
    if (!releaseIds.has(story.release))
      problems.push(`Story ${story.id} refers to unknown release "${story.release}".`);
  }
  return problems;
}
