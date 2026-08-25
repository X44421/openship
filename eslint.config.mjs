// Workspace dependency-boundary ESLint configuration — FE1-S1 (#19).
//
// Delivers the guard-rule bodies frozen by the FE0-C1 §4 guard table and the
// FE0-C2 §2 allowed-edge set as lint errors:
//   - local rule `boundary/no-clean-engine-imports` (rule name pinned by the
//     FE0-C1 contract; AST-exact for relative / bare-subpath / dynamic forms)
//   - core `no-restricted-imports` scoped per package for the frozen edge set
//     (contracts imports nothing internal; client/studio-ui/dev-fixtures only
//     reach @stillflow/contracts; apps reach the new packages per the §2 list;
//     retired apps may not join the new topology at all)
//
// Deliberately has NO other lint rules and no stylistic opinion: adopting a
// repo-wide ESLint baseline is a quality-gate decision owned by FE1-S6 (#24).
// This config only enforces boundaries (plus the minimum parser needed to
// lint TypeScript sources).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tseslintParser from "@typescript-eslint/parser";

import { noCleanEngineImports } from "./scripts/eslint-rules/no-clean-engine-imports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));

const MESSAGES = {
  contracts:
    "@stillflow/contracts contains generated artifacts only and must not import any workspace member (FE0-C2 §1; internal self-subpaths stay under its own src)",
  newPackageLegacy: "new @stillflow/* packages must not depend on legacy @repo/* members (FE0-C2 §2)",
  newPackageFixtures:
    "contracts/client/studio-ui are hard-banned from @stillflow/dev-fixtures (FE0-C2 §2), tests included",
  studioUiClient:
    "@stillflow/studio-ui must not import @stillflow/client (FE0-C2 §2: UI never issues requests)",
  clientStudioUi:
    "@stillflow/client must not import @stillflow/studio-ui (FE0-C2 §2: client is UI-free)",
  appFixtures: "apps must reach @stillflow/dev-fixtures from test scopes/devDependencies only (FE0-C2 §2)",
  retiredApps:
    "retired apps (api/email/web/edge) are replace/delete objects and must not join the target topology (FE0-C2 §4)",
  appContracts:
    "apps must not import @stillflow/contracts directly; DTO access flows through @stillflow/client (FE0-C2 §2)",
  appStudioUi:
    "only web-client (apps/dashboard) consumes @stillflow/studio-ui; desktop/cli go through @stillflow/client (FE0-C2 §2)",
};

// --- Frozen edge-set derivation (FE0-C2 §2/§5) ------------------------------
// R2 audit fix: scopes below are derived mechanically from the explicit FE0-C2
// §5 target edge set, and EVERY banned internal package is expressed as a
// root + subpath pattern pair (`@x`, `@x/*` — the bare entry pins the package
// root, the `/*` entry cascades into nested subpaths), so subpath forms like
// `@stillflow/studio-ui/internal` cannot slip through. desktop/cli get their
// own narrow scope instead of sharing dashboard's broad one.
const INTERNAL_PACKAGES = [
  "@stillflow/contracts",
  "@stillflow/client",
  "@stillflow/studio-ui",
  "@stillflow/dev-fixtures",
];

// Explicit allowlist, verbatim from the FE0-C2 §5 target edge set:
//   web-client / desktop / cli → client → contracts;
//   web-client → studio-ui → contracts; dev-fixtures → contracts.
const ROLE_ALLOWED = {
  webClient: ["@stillflow/client", "@stillflow/studio-ui"],
  desktop: ["@stillflow/client"],
  cli: ["@stillflow/client"],
};

/** Root + subpath pattern pair for one banned workspace package. */
const restricted = (name, message) => ({ group: [name, `${name}/*`], message });

export default [
  {
    // Inline config comments are disabled entirely (invoked via
    // `eslint . --no-inline-config` in the lint:boundaries script): boundary
    // violations are policy guards and must not be suppressible with
    // eslint-disable comments. The repo's hundreds of legacy directives for
    // @typescript-eslint/react rules from its former baseline are therefore
    // inert under this flat config, and baseline rule adoption + directive
    // hygiene are the FE1-S6 (#24) quality-gate remit.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.d.ts",
      "packages/contracts/src/generated/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      boundary: { rules: { "no-clean-engine-imports": noCleanEngineImports } },
    },
    rules: {
      "boundary/no-clean-engine-imports": "error",
    },
  },
  // --- Frozen edge set, scoped per member (FE0-C2 §2) -----------------------
  {
    files: ["packages/contracts/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@stillflow/*", "@repo/*"], message: MESSAGES.contracts }] },
      ],
    },
  },
  // New packages reach only @stillflow/contracts (§2 允许); sibling new
  // packages are banned root+subpath; legacy members via @repo/* are banned.
  {
    files: ["packages/client/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            restricted("@stillflow/studio-ui", MESSAGES.clientStudioUi),
            restricted("@stillflow/dev-fixtures", MESSAGES.newPackageFixtures),
            { group: ["@repo/*"], message: MESSAGES.newPackageLegacy },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/studio-ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            restricted("@stillflow/client", MESSAGES.studioUiClient),
            restricted("@stillflow/dev-fixtures", MESSAGES.newPackageFixtures),
            { group: ["@repo/*"], message: MESSAGES.newPackageLegacy },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/dev-fixtures/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            restricted("@stillflow/client", MESSAGES.clientStudioUi),
            restricted("@stillflow/studio-ui", MESSAGES.studioUiClient),
            { group: ["@repo/*"], message: MESSAGES.newPackageLegacy },
          ],
        },
      ],
    },
  },
  // Target-role apps consume per the §2 allowlist: every non-allowed internal
  // package is banned root+subpath. dev-fixtures additionally carries its own
  // production-scope semantics (test/storybook scopes exempted in the next
  // block). Legacy @repo/* stock stays out of scope here — consumed by FE5
  // retirement slices, with the clean-engine subtree covered by the local
  // boundary/no-clean-engine-imports rule above.
  {
    files: ["apps/dashboard/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: INTERNAL_PACKAGES.filter(
            (name) => !ROLE_ALLOWED.webClient.includes(name),
          ).map((name) =>
            name === "@stillflow/dev-fixtures"
              ? restricted(name, MESSAGES.appFixtures)
              : restricted(name, MESSAGES.appContracts),
          ),
        },
      ],
    },
  },
  {
    files: ["apps/desktop/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: INTERNAL_PACKAGES.filter(
            (name) => !ROLE_ALLOWED.desktop.includes(name),
          ).map((name) =>
            name === "@stillflow/dev-fixtures"
              ? restricted(name, MESSAGES.appFixtures)
              : name === "@stillflow/studio-ui"
                ? restricted(name, MESSAGES.appStudioUi)
                : restricted(name, MESSAGES.appContracts),
          ),
        },
      ],
    },
  },
  {
    files: ["apps/cli/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: INTERNAL_PACKAGES.filter((name) => !ROLE_ALLOWED.cli.includes(name)).map(
            (name) =>
              name === "@stillflow/dev-fixtures"
                ? restricted(name, MESSAGES.appFixtures)
                : name === "@stillflow/studio-ui"
                  ? restricted(name, MESSAGES.appStudioUi)
                  : restricted(name, MESSAGES.appContracts),
          ),
        },
      ],
    },
  },
  // Test/storybook sources inside target apps may use fixtures.
  {
    files: [
      "apps/{dashboard,desktop,cli}/**/*.{test,spec,stories}.{ts,tsx}",
      "apps/{dashboard,desktop,cli}/**/__tests__/**/*.{ts,tsx}",
      "apps/{dashboard,desktop,cli}/**/__mocks__/**/*.{ts,tsx}",
    ],
    rules: { "no-restricted-imports": "off" },
  },
  // Retired apps must not join the new topology at all.
  {
    files: ["apps/{api,email,web,edge}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@stillflow/*"], message: MESSAGES.retiredApps }] },
      ],
    },
  },
];