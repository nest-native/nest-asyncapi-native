# GUIDELINES_NEST_ASYNCAPI.md

## Core Philosophy — This library MUST feel native in NestJS projects

Every decision must follow NestJS philosophy as `@nestjs/swagger` does, while
staying faithful to AsyncAPI 3.0's channels/operations/messages model. The
bar is: feel like the AsyncAPI counterpart to `@nestjs/swagger`, generate
spec-compliant output, never hide AsyncAPI semantics.

### 1. Overall Architecture Assumptions (never break these)

- First-class NestJS integration, not a thin wrapper around AsyncAPI tooling.
- Decorator-first, OOP, heavy use of NestJS DI.
- Mirror the DX of `@nestjs/swagger` (decorator-based metadata +
  generate-on-build) for the event/message side.
- Documentation only — this is NOT a runtime transport. Use
  `@nestjs/microservices` or `@nest-native/kafka` for transport.
- Current stabilization support line:
  - Node.js `>=22` (`>=22.12` to load NestJS 12 from CommonJS)
  - NestJS `11.x` / `12.x` (peer `^11.0.0 || ^12.0.0`; see the NestJS 12
    entries under Accumulated Project Decisions)
  - AsyncAPI spec target 3.0 (2.x: best-effort conversion only)
- AsyncAPI viewer: `@asyncapi/react-component` rendered at a configurable
  route.
- Support both validation worlds for message payloads:
  - `class-validator` + DTOs (default; metadata-driven JSON Schema,
    mirroring `@nestjs/swagger`)
  - Zod (optional; via `z.toJSONSchema()`)

### 2. Public API Assumptions (this is what users will copy-paste)

- Module:
  - `AsyncApiModule.forRoot(options)`
  - `AsyncApiModule.forRootAsync(options)`
- Decorators (mirror `@nestjs/swagger` naming):
  - `@AsyncApiChannel('channel-id', options)` — class-level on a handler
  - `@AsyncApiPub({...})` / `@AsyncApiSub({...})` — method-level
  - `@AsyncApiMessage(MessageDto)` — payload metadata
  - `@AsyncApiHeaders(HeadersDto)` — headers metadata
  - `@AsyncApiServer(name, options)` — server declaration
- Function-level helpers:
  - `getAsyncApiDocument(app, config)` — analogous to
    `SwaggerModule.createDocument`
- Discovery uses NestJS metadata reflection exactly as `@nestjs/swagger`
  does for `@Controller`.

### 3. First-Version Scope Discipline

- v1 ships:
  - AsyncAPI 3.0 spec generation from decorated handlers
  - Hosted docs route with viewer
  - Bindings for Kafka, NATS, MQTT, AMQP (transport identifiers and
    connection metadata at minimum)
  - Integration with `@nestjs/microservices` handlers (`@MessagePattern`,
    `@EventPattern`)
  - Optional integration with `@nest-native/kafka` if shipped
  - DTO ↔ JSON Schema generation via the path `@nestjs/swagger` uses
- v1 does NOT ship:
  - Full AsyncAPI 2.x support (best-effort conversion or none)
  - Spec-driven scaffolding (spec → code)
  - Mock broker / contract testing
  - OpenAPI → AsyncAPI conversion

### 4. Sample Folder Rules

- `sample/00-showcase` demonstrates:
  - All five decorators end-to-end
  - Both class-validator and Zod validation paths
  - Multiple transport bindings (Kafka + NATS at minimum)
  - Docs route with live viewer
  - Generated spec validated against `@asyncapi/parser`
- Focused samples: one per binding, one per validation style, one for
  `forRootAsync`, one for migration from `nestjs-asyncapi`.
- The showcase must produce a valid AsyncAPI 3.0 spec on every run.
- Never simplify the showcase for brevity — richness proves the integration
  depth.

### 5. Implementation Rules

- Spec generator is metadata-driven; it walks NestJS `MetadataScanner`
  exactly as `@nestjs/swagger` does.
- Generated output must pass `@asyncapi/parser` validation. Treat parser
  errors as build failures.
- Viewer assets: bundled if reasonably small; otherwise via documented
  `peerDependencies` install.
- Output format: YAML default, JSON optional; document the convention.
- Never invent non-standard AsyncAPI extensions. Use spec primitives only.
- Schema generation reuses the `@nestjs/swagger` chain when class-validator
  is in play. Do not introduce a parallel schema reflector.
- Keep the package lean — `"dependencies": {}`. AsyncAPI parser, viewer,
  and Nest packages in `peerDependencies`.
- Never expose AsyncAPI tooling internals unless the user opts in via
  advanced config.

### 6. Non-Negotiable Style & Patterns

- NestJS naming conventions (`@nestjs/common` style).
- Constructor injection.
- Documentation and README follow Nest-style clarity without claiming
  official Nest or AsyncAPI status.
- Preserve clear API tiers: onboarding focuses on `AsyncApiModule` and the
  five decorators. Advanced features (custom bindings, custom servers,
  spec post-processing) stay in dedicated sections.

### 7. When In Doubt

- Ask: "Would this feel natural in `@nestjs/swagger` while still feeling
  like real AsyncAPI 3.0?"
- If the answer is no, redesign.

### 8. Differentiation Strategy

- AsyncAPI 3.0 native — the abandoned `nestjs-asyncapi` is 2.x and broken
  on current Node/NestJS.
- Mirrors `@nestjs/swagger`'s familiar shape exactly — same mental model
  for any Nest user who has documented an HTTP API.
- Validated output: every generated spec passes the official parser.
- Documentation route comes with a working viewer; not a "wire it
  yourself" experience.

### 9. Security Review Requirements (MANDATORY)

- Every PR includes an explicit security pass.
- Supply-chain checks are NON-NEGOTIABLE:
  - Every dependency addition/update reviewed for legitimacy.
  - `packages/asyncapi/package.json` must keep `"dependencies": {}`.
  - Viewer asset bundling reviewed at every update for size and
    supply-chain risk.
  - Inspect lifecycle scripts on every dep change.
  - Flag unpinned Git/URL dependencies.
- Application security checks:
  - Docs route auth boundaries (the spec may leak schema details that
    aren't intended for unauthenticated readers).
  - XSS in the viewer's rendered content.
  - No secrets in generated example payloads.
  - URL-injection in `@AsyncApiServer` configurations.

### 10. Release Version Synchronization (MANDATORY)

- Version drift between `packages/asyncapi` and `sample/*` is a release
  blocker.
- When bumping `packages/asyncapi/package.json`, update all
  `sample/*/package.json` entries for `"@nest-native/asyncapi"` in the same
  change.
- Regenerate `package-lock.json`. Run `npm run release:check`. Run
  `npm run ci`.
- Post-publish: re-run full CI with samples pinned to the published version.
- **Prose version literals are release-blocking too.** The bolded `Status:` line
  in `README.md` and `packages/asyncapi/README.md`, the published release line in
  `CONTRIBUTING.md`, badges, and any compatibility table must state the version
  that is actually published. A stale literal is a documentation lie, not a
  cosmetic nit: it is the first thing a user reads and it silently contradicts
  npm. `release:check:readme-version`
  (`scripts/check-readme-version.mjs`) enforces this and fails the gate on drift.
- **Prefer dynamic badges over hardcoded ones.** Version and status badges must be
  generated (`img.shields.io/npm/v/@nest-native/asyncapi.svg`), never hand-written —
  a hardcoded badge is drift waiting to happen. `release:check:readme-version`
  rejects `img.shields.io/badge/version-…` and `img.shields.io/badge/status-…`
  literals outright.
- **Version-sync checks iterate, they do not hardcode.** Any check in `scripts/`
  that reasons about the published version must enumerate every non-private
  `packages/*/package.json` and read the version from there, rather than hardcoding
  a package name or a version string. The repo ships one package today; a check
  written to that assumption goes quietly blind the day a second one lands.

### 11. Cognitive Complexity Review

- When changes touch `packages/asyncapi/**/*.ts`, run
  `npm run complexity:check` and `npm run complexity:report`.
- CI enforces SonarJS cognitive-complexity threshold of `15` per package
  source function.
- Do not reduce complexity by weakening generator correctness, public API
  clarity, or test coverage.

### 12. Accumulated Project Decisions

(Empty at v0; grows as the project lands decisions worth preserving. Append
entries here when an architectural call repeats or is non-obvious. Each
entry should be one short paragraph with rationale.)

- **Audit scope.** The `security:audit` release gate audits the *published*
  surface — `npm audit --omit=dev --audit-level=high`. Since the package
  publishes `"dependencies": {}`, this is exactly what consumers install.
  Advisories confined to dev/peer/build tooling or the docs `website/` are
  tracked and patched via Dependabot but do not block releases — they cannot
  reach consumers. Patch them in their own PRs.
- **The docs audit reports, it does not gate.** `security:audit` hard-fails only
  on the *published* surface; `security:audit:docs` still runs and prints, but
  cannot fail the build. This makes the gate match the rule above — website
  advisories cannot reach consumers, so they must not block every PR in the
  repo. Precedent: `@nest-native/cache` and `@nest-native/trpc` were already
  package-only. Trigger: `image-size` (GHSA-w3rx-r6r6-pgpr,
  GHSA-5p2g-fcmc-qvqq) has NO patched version — 2.0.2 is both the latest
  release and vulnerable — and arrives through `@docusaurus/mdx-loader`, so the
  gate was unfixable by any dependency change. Dependabot still tracks the
  website tree; fix docs advisories when a fix exists.

- **Strictness scope.** The non-negotiables (100% coverage,
  cognitive-complexity ≤ 15, zero published runtime deps, isolated
  major-version review) govern the *core* published package
  (`packages/asyncapi`). Non-core code — `sample/*`, the `website/`, and dev
  tooling — uses lighter rules: their dependency updates (including majors) may
  merge on green CI without the core's major-isolation ceremony.

- **Peer majors are widened, never swapped — applied to NestJS 12.** The
  published peer range is `@nestjs/common` / `@nestjs/core`
  `^11.0.0 || ^12.0.0`. The devDependencies and the lockfile stay on 11: that
  is what `npm ci` and the default jobs test. The `nestjs-latest-major` CI leg
  installs the 12 set on top with `npm install --no-save --workspaces
  --include-workspace-root` and re-runs the build, typecheck, the suite, and
  the whole sample matrix, so both ends of the range are tested claims (build
  first: the samples import `@nest-native/asyncapi` through the workspace
  link, whose entry points live in `packages/asyncapi/dist`, so a fresh
  checkout cannot typecheck the samples before the package is built). A
  dependabot PR that moves a `@nestjs/*` devDependency to 12 is declined —
  merging it would stop testing the 11 end. Load-bearing details of the leg:
  `--workspaces --include-workspace-root`, not `--workspace-root`, because the
  samples pin `@nestjs/*` exactly and npm otherwise satisfies each sample's 11
  pin with a nested 11 copy while the root reports 12;
  `scripts/check-resolved-nestjs-major.mjs 12` runs in the leg and fails it on
  any other major or any nested copy, so a green leg is a claim about 12 only
  because of that check. Every `@nestjs/*` package any workspace declares
  (`common`, `core`, `platform-express`, `testing`, `swagger`,
  `microservices`) goes in ONE install command: `--no-save` never persists
  the 12 edges, so a second `npm install` reconciles the tree back to the 11
  lockfile, and `@nestjs/swagger` / `@nestjs/microservices` 12 peer on
  common/core 12, so leaving either on 11 is an ERESOLVE. Never hide such a
  conflict with `--legacy-peer-deps` — a leg that needs it is reporting an
  unsupported combination, not a flaky install. Nothing may
  `require('@nestjs/<pkg>/package.json')` to read a version: the 12 exports
  map does not expose it; read the manifest by path or walk up from
  `require.resolve`.
- **The lockfile must resolve every workspace's `@nestjs/*` from the root.**
  Every sample pins exactly the versions the root resolves, so a copy nested
  under `sample/*/node_modules` is lockfile drift: the samples then exercise
  a different NestJS than the suite, and the nested copy's `^11` peer makes
  the 12 leg ERESOLVE before anything runs. This happened silently — grouped
  dependabot bumps rewrote the sample manifests to `@nestjs/swagger` 11.4.7
  and `@types/node` 26.2.0 while the lockfile kept nested 11.4.4 / 26.0.1
  entries under all seven samples, and `npm ci` accepted it because it only
  compares the manifests with the lockfile's recorded specs, not the nested
  nodes. `npm run release:check:nestjs-resolution` (part of `release:check`,
  so of `npm run ci`) now fails on any nested `@nestjs/*` copy or any major
  other than the root `@nestjs/core` devDependency's. Fix drift by deleting
  the stale `sample/*/node_modules/*` lockfile entries and running
  `npm install --package-lock-only`; `npm install` and `npm dedupe` alone do
  not repair invalid nested nodes.
- **NestJS 12 is ESM-only.** `@nestjs/common` and `@nestjs/core` publish
  `"type": "module"` with an exports map of `.`, `./internal`, `./*.js`, and
  `./*` → `./*.js`. A deep import of a *file* (`@nestjs/core/injector/
  constants`) still resolves; a deep import of a *directory index*
  (`@nestjs/common/interfaces`) does not, because ESM never resolves a
  directory through `./*`. This package has no deep `@nestjs/*` imports and
  must keep it that way: import from the package roots only, exactly as the
  `@nestjs/swagger` chain is reached today. If an internal is ever genuinely
  needed, land it together with the test the kafka and trpc repos carry — one
  that scans the source for every `@nestjs/<pkg>/<subpath>` import and asserts
  the subpath resolves to a real file inside `node_modules/@nestjs/<pkg>`,
  never a directory — in the same PR, not after.
- **Lifecycle hook order changed in 12.** Hooks now run by component
  hierarchy level rather than registration order. Nothing in this package or
  its samples may assume a cross-provider order between `onModuleInit` /
  `onApplicationBootstrap` / shutdown hooks of different providers; document
  generation walks the finished container and does not participate in hooks,
  and no test asserts a hook order.

### 13. Mutation testing (Stryker — occasional targeted audit, local only, never in CI)

Everything here is **opt-in and local-only**. Plain `npm test` and CI are
unchanged; forks work out of the box. **CI never runs mutation testing** — it
is an on-demand, local-only gate.

- `npm run test:mutation` — **incremental** run (cache:
  `reports/stryker-incremental.json`; only re-tests what changed). This is the
  pre-PR ritual for changes to package source.
- `npm run test:mutation:full` — every mutant from scratch (`--force`).
- `STRYKER_MUTATE='packages/asyncapi/generator.ts,packages/asyncapi/schema/**'` —
  comma-separated globs to scope a run to the files a change touched.
- Report: `reports/mutation/mutation.html`. Thresholds are advisory
  (`break: null`) — the signal is *which mutants survive*, not the score.

**Occasional targeted audit, not a per-PR gate.** Run mutation testing
deliberately when you've reworked a file's logic — not on every PR. Scope
`STRYKER_MUTATE` to that one file, keep `--concurrency 2`, and verify a kill the
fast way: hand-apply the surviving mutation, run the plain suite, confirm your
new test fails, then `git checkout --` to revert. Full/unscoped runs re-test
every mutant against the whole suite and are slow to impractical — lean on
scoped runs plus hand-verification, and `kill -9` any leftover `stryker`
processes after a timeout. Treat survivors by the doctrine (add a test /
simplify redundant code / `// Stryker disable` a true equivalent / assert bounds
for timing). Keep CI fast — that is a deliberate contract.
