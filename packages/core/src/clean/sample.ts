import type { ColumnId, LogicalField, LogicalSchema, LogicalType } from "./types";
import { LOGICAL_SCHEMA_VERSION } from "./types";

function columnId(n: number): ColumnId {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export const SAMPLE_CUSTOMERS_ASSET_ID =
  "00000000-0000-4000-8000-0000000000c1";

const FIELD_SPECS: Array<{
  n: number;
  name: string;
  dataType: LogicalType;
  nullable: boolean;
}> = [
  { n: 1, name: "customer_id", dataType: "utf8", nullable: false },
  { n: 2, name: "name", dataType: "utf8", nullable: true },
  { n: 3, name: "email", dataType: "utf8", nullable: true },
  { n: 4, name: "amount", dataType: "float64", nullable: true },
  { n: 5, name: "category", dataType: "utf8", nullable: true },
  { n: 6, name: "status", dataType: "utf8", nullable: true },
  { n: 7, name: "created_at", dataType: "utf8", nullable: true },
  { n: 8, name: "margin_pct", dataType: "float64", nullable: true },
];

export const SAMPLE_CUSTOMER_FIELDS: LogicalField[] = FIELD_SPECS.map((f) => ({
  id: columnId(f.n),
  name: f.name,
  dataType: f.dataType,
  nullable: f.nullable,
}));

export const SAMPLE_CUSTOMER_SCHEMA: LogicalSchema = {
  version: LOGICAL_SCHEMA_VERSION,
  fields: SAMPLE_CUSTOMER_FIELDS,
};

export const COL = Object.fromEntries(
  SAMPLE_CUSTOMER_FIELDS.map((f) => [f.name, f.id]),
) as Record<string, ColumnId>;

/** Fixture aligned with stillflow `sample-customers` (bounded, dirty on purpose). */
const RAW: Array<Record<string, unknown>> = [
  ["C001", "Alice Chen", "alice@example.com", 245.5, "Electronics", "completed", "2026-01-15", 22.3],
  ["C002", "Bob Martinez", "bob@example.com", 89.99, "Books", "pending", "2026-01-18", 15.0],
  ["C003", "Clara Johnson", "clara@example.com", 312.0, "Clothing", "completed", "2026-01-20", 18.5],
  ["C004", "David Kim", "david@example.com", 56.0, "Food", "completed", "2026-01-22", 12.8],
  ["C005", "Elena Rodriguez", "elena@example.com", 178.0, "Books", "completed", "2026-02-01", 20.1],
  ["C006", "Felix Ortiz", null, 450.0, "Software", "completed", "2026-02-03", 35.2],
  ["C007", "Grace Lee", "grace@example.com", 92.5, "Beauty", "pending", "2026-02-05", 14.7],
  ["C008", "Hiro Tanaka", "hiro@example.com", 667.0, "Electronics", "completed", "2026-02-08", 28.9],
  ["C009", "Isabel Santos", "isabel@example.com", 134.0, "Home", "completed", "2026-02-10", 16.3],
  ["C010", "James Wilson", "james@example.com", null, "Sports", "completed", "", 22.0],
  ["C011", "Keiko Yamamoto", "keiko@example.com", 88.0, "Toys", "pending", "2026-02-14", 11.5],
  ["C012", "Leo Anderson", "leo@example.com", null, "Music", "completed", "2026-02-15", 19.2],
  ["C013", "Maria Garcia", "maria@example.com", 295.0, "Beauty", "completed", "2026-02-18", 21.8],
  ["C014", "Nina Patel", "nina@example.com", 567.0, "Software", "completed", "2026-02-20", 42.1],
  ["C015", "Omar Hassan", "omar@example.com", 45.5, "Pet", "completed", "2026-02-22", 8.3],
  ["C016", "Priya Sharma", "priya@example.com", 210.0, "Office", "completed", "2026-02-25", 17.6],
  ["C017", "Quinn Murphy", "quinn@example.com", 378.0, "Electronics", "completed", "2026-03-01", 31.4],
  ["C018", "Ravi Desai", "ravi@example.com", 99.99, "Books", "pending", "", 14.2],
  ["C019", "Sofia Bianchi", "sofia@example.com", null, "Clothing", "completed", "2026-03-05", null],
  ["C020", "Tao Wang", "tao@example.com", 445.0, "Software", "pending", "2026-03-08", 38.7],
  ["C021", "", "uma@example.com", 67.0, "Food", "pending", "2026-03-10", 9.5],
  ["C022", "Viktor Petrov", "viktor@example.com", 189.0, "Home", "completed", "2026-03-12", 15.8],
  ["C023", "Wendy Chang", "wendy@example.com", 723.0, "Electronics", "completed", "2026-03-15", 33.6],
  ["C024", "Xiao Li", "xiao@example.com", 156.0, "Books", "completed", "2026-03-18", 19.9],
  ["C025", "Yuki Tanaka", "yuki@example.com", 278.0, "Beauty", "pending", "2026-03-20", 23.4],
  ["C026", "Zara Ahmed", "zara@example.com", 134.0, "Toys", "pending", "2026-03-22", 12.1],
  ["C027", "Alice Chen", "alice@example.com", 245.5, "Electronics", "completed", "2026-01-15", 22.3],
  ["C028", "David Kim", "david@example.com", 56.0, "Food", "completed", "2026-01-22", 12.8],
  ["C029", "Ravi Desai", "ravi@example.com", 99.99, "Books", "pending", "", 14.2],
  ["C030", "Bob Martinez", "bob@example.com", 145.0, "Electronics", "completed", "2026-03-25", 18.9],
  ["C031", "Clara Johnson", "clara@example.com", 312.0, "Clothing", "completed", "2026-01-20", 18.5],
  ["C032", "Elena Rodriguez", "elena@example.com", 178.0, "Books", "completed", "2026-02-01", 20.1],
  ["C033", "Grace Lee", "grace@example.com", 92.5, "Beauty", "pending", "2026-02-05", 14.7],
  ["C034", "", "holo@example.com", 34.0, "Pet", "completed", "2026-03-28", 6.2],
  ["C035", "Maria Garcia", "maria@example.com", 295.0, "Beauty", "completed", "2026-02-18", 21.8],
  ["C036", "Nina Patel", "nina@example.com", 567.0, "Software", "completed", "2026-02-20", 42.1],
  ["C037", "Omar Hassan", "omar@example.com", 45.5, "Pet", "completed", "2026-02-22", 8.3],
  ["C038", "Ivan Petrov", "ivan@example.com", 892.0, "Software", "completed", "2026-03-30", 44.5],
  ["C039", "Tao Wang", "tao@example.com", 445.0, "Software", "pending", "2026-03-08", 38.7],
  ["C040", "Alice Chen", "  alice@example.com  ", 12.0, "Electronics", "", "2026-04-01", 10.0],
].map((tuple) => {
  const row: Record<string, unknown> = {};
  const keys = [
    "customer_id",
    "name",
    "email",
    "amount",
    "category",
    "status",
    "created_at",
    "margin_pct",
  ];
  for (let i = 0; i < keys.length; i++) {
    const id = COL[keys[i]!];
    let value = tuple[i];
    if (value === "") value = null;
    row[id!] = value;
  }
  return row;
});

export function loadSampleAsset(sourceAssetId: string): {
  schema: LogicalSchema;
  rows: Record<string, unknown>[];
} {
  if (sourceAssetId !== SAMPLE_CUSTOMERS_ASSET_ID) {
    throw new Error(`Unknown source asset ${sourceAssetId}`);
  }
  return {
    schema: SAMPLE_CUSTOMER_SCHEMA,
    rows: RAW.map((row) => ({ ...row })),
  };
}
