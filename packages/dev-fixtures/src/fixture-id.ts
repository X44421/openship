/**
 * Builds a stable, sortable fixture identifier (`prefix-0001`).
 * Deterministic by design: same inputs must always yield the same id so
 * snapshots and Storybook stay reproducible.
 */
export function fixtureId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}
