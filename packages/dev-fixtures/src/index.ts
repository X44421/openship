// @stillflow/dev-fixtures — deterministic data factories for tests,
// Storybook, and development entries only. Production entries must never
// import this package (enforced by scripts/check-dependency-boundaries.mjs).
//
// Skeleton mechanism in FE1-S1 (#19); migration of existing demo data into
// this package is dispatched as FE1-S5 (openship#23).

/**
 * Builds a stable, sortable fixture identifier (`prefix-0001`).
 * Deterministic by design: same inputs must always yield the same id so
 * snapshots and Storybook stay reproducible.
 */
export function fixtureId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}
