// Wording of user-facing messages.

/** "1 story", "2 stories": a count with the right form of its noun. */
export function plural(count, singular, pluralForm = singular + "s") {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
