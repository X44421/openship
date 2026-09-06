// @stillflow/dev-fixtures — deterministic data factories for tests,
// Storybook, and development entries only. Production entries must never
// import this package (enforced by scripts/check-dependency-boundaries.mjs
// and the production-bundle scan).
//
// Skeleton mechanism in FE1-S1 (#19); FE1-S5 (openship#23) makes this package
// the single authoritative source for fixture datasets.

export { fixtureId } from "./fixture-id";
export {
  SAMPLE_CUSTOMERS_ASSET_ID,
  SAMPLE_CUSTOMER_COLUMNS,
  SAMPLE_CUSTOMER_FIELDS,
  SAMPLE_CUSTOMERS_ROW_COUNT,
  SAMPLE_CUSTOMER_SCHEMA,
  loadSampleCustomerAsset,
  type SampleColumn,
  type SampleColumnType,
  type SampleSchema,
} from "./sample-customers";
