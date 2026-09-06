# Changelog

All notable user-facing changes to `@nest-native/asyncapi` are tracked here.

This project follows semantic versioning for the published package. Sample,
documentation, and CI-only changes may remain in `Unreleased` until the next
package release is useful for users.

## Unreleased

- **NestJS 12 is now an allowed peer** (`@nestjs/common` / `@nestjs/core`
  `^11.0.0 || ^12.0.0`). Nothing in the package changed: the whole suite
  (126 tests, 100% coverage), typecheck, build, and all seven samples —
  including the `@nestjs/swagger` 12 schema chain and the
  `@nestjs/microservices` 12 migration sample — run unmodified on 12.0.1.
  Isolated major-version review: 12 is ESM-only with an exports map that no
  longer resolves directory indexes — this package imports only from the
  `@nestjs/*` roots, so it is unaffected — and 12 runs lifecycle hooks by
  hierarchy level, an order document generation never depended on. A consumer
  on 12 needs Node `>=22.12` when loading NestJS from CommonJS (`require(esm)`)
  and, for DTO schemas, `@nestjs/swagger` 12, whose own peers require the 12
  core. The range is widened, not moved: the devDependencies stay on 11 and a
  new CI leg (`nestjs-latest-major`) installs 12 on top and re-runs typecheck,
  the suite, the build, and the sample matrix against it, with a check that
  every workspace really resolved 12 rather than a nested 11.
- Repo tooling: `release:check` now fails when any workspace resolves an
  `@nestjs/*` package from a copy nested under it instead of the root
  `node_modules`. The lockfile had drifted that way — the sample manifests
  declared `@nestjs/swagger` 11.4.7 and `@types/node` 26.2.0 while the
  lockfile kept nested 11.4.4 / 26.0.1 copies under every sample, so the
  samples were exercising an older `@nestjs/swagger` than the package suite.
  The stale entries are removed; every workspace now resolves the hoisted
  versions it declares.
- Stryker mutation testing (repo tooling; nothing ships in the package):
  `npm run test:mutation` (incremental) / `npm run test:mutation:full`, with
  `STRYKER_MUTATE` scoping (comma-separated globs). Opt-in and local-only —
  CI is unchanged. See the new "Mutation testing" section in
  GUIDELINES_NEST_ASYNCAPI.md.
- Internal: simplified three redundant branches in the YAML serializer
  (`isInline` folds arrays into the shared empty-container check, `formatScalar`
  lets `String()` spell `null`, and `emitArray` uses one dash-line form for
  inline and block entries). Behavior-neutral — identical serializer output,
  verified by the existing suite and the `@asyncapi/parser` round-trip — and it
  trims the emitter's cognitive complexity.

## 0.2.0 - 2026-07-01

### Added

- `@AsyncApiMessage` and `@AsyncApiHeaders` now accept a Zod schema directly:
  pass `{ name, schema }` where `schema` is the Zod schema itself and the
  generator converts it with Zod 4's native `z.toJSONSchema()`
  (`target: 'draft-7'`, the dialect AsyncAPI 3.0 documents default to) and
  registers the result exactly like a pre-computed JSON Schema. Previously the
  event contract had to be converted by hand at every source, duplicating
  shapes that already exist in Zod. Detection uses the Standard Schema
  `~standard` marker plus Zod's validator surface (`def` + `safeParse`), so
  the JSON Schema `z.toJSONSchema()` emits — which Zod 4.4+ also tags with a
  non-enumerable marker — keeps registering verbatim, and a live schema from
  another Standard Schema vendor is rejected with an actionable error instead
  of being embedded as an object graph. The accepted schema is typed
  structurally (`StandardSchemaLike`), so consumers without Zod installed
  still typecheck; the new `ZodSchemaSource` joins the `SchemaSource` union.
  `zod` (`^4`) becomes a declared optional peer, required lazily only when a
  Zod source is registered — never at module load — and the published package
  keeps `"dependencies": {}`. Registering a Zod source without `zod` (or with
  a pre-4 major, which lacks the native converter) fails with an actionable
  error. Generated documents still validate against `@asyncapi/parser`.
  Pre-computed `{ name, schema }` sources remain supported unchanged for
  custom conversion options; the showcase and Zod samples now pass their Zod
  schemas directly.

## 0.1.2 - 2026-06-22

### Changed

- The optional Zod validation path now uses Zod 4's native `z.toJSONSchema()`
  (with `target: 'draft-7'`) instead of the separate `zod-to-json-schema`
  package. The samples, tests, and docs convert Zod schemas this way; the dev
  and sample `zod` dependency moves to `^4`. The published package is unaffected
  — it still keeps `"dependencies": {}`, never imports Zod, and registers the
  pre-computed `{ name, schema }` verbatim, so any Zod-to-JSON-Schema converter
  still works. Generated documents continue to validate against
  `@asyncapi/parser`.

### Internal

- The `security:audit:package` release gate now packs the published tarball,
  installs it into a throwaway project with `--omit=dev`, and audits that real
  production closure (`scripts/audit-production-surface.mjs`) instead of running
  `npm audit` against the shared workspace lockfile. This audits exactly what
  consumers install and stops dev/peer/sample-only advisories from being
  conflated with the published surface.

## 0.1.1 - 2026-06-15

A documentation-truth and samples release. No runtime behavior changed; the
published package keeps `"dependencies": {}`.

### Added

- `sample/06-forrootasync-config`: a focused sample that registers the module
  with `AsyncApiModule.forRootAsync`, resolving the document defaults
  asynchronously from an injected `ConfigService` before generating the
  document. Its smoke test asserts the async-resolved config seeds the
  generated `info` block and validates the document with `@asyncapi/parser`.
  Wired into the sample matrix and the sample catalog.

### Docs

- Dropped the "under construction" framing now that the v1 surface is complete.
  The package README's `[!WARNING]` status block is replaced with a `[!NOTE]`
  "v0.1.x — stable, v1 surface complete" block, and the stale "scaffold" /
  "later milestones" language in `CONTRIBUTING.md`, the `AsyncApiModule` and
  `interfaces` JSDoc, the scanner and document-model JSDoc, and the showcase
  sample README is corrected to the shipped reality.

## 0.1.0 - 2026-06-14

First public release of `@nest-native/asyncapi`. The package generates AsyncAPI
3.0 documentation from decorated NestJS handlers, mirroring `@nestjs/swagger` for
the event and message side, and ships a docs route with the AsyncAPI viewer.

### Added

- Documentation site built with Docusaurus under `website/`, covering getting
  started, the five decorators, document generation, the docs route, transport
  bindings, the public API reference, validation (class-validator and Zod), the
  `nestjs-asyncapi` migration, the sample catalog, and project reference pages
  (support policy, quality and CI, security, release, contributing, roadmap). A
  `docs-site` CI job builds the site (`onBrokenLinks: throw`), a
  `deploy-docs.yml` workflow publishes it to GitHub Pages, and `npm run ci` now
  includes `ci:docs` plus a docs supply-chain audit.

This release rolls up the v0.0.x development line:

- `AsyncApiModule.forRoot()` / `forRootAsync()` for global configuration and
  `AsyncApiModule.setup()` for serving the viewer.
- The five decorators (`@AsyncApiChannel`, `@AsyncApiPub` / `@AsyncApiSub`,
  `@AsyncApiMessage`, `@AsyncApiHeaders`, `@AsyncApiServer`) plus the binding
  decorators (`@AsyncApiChannelBindings`, `@AsyncApiOperationBindings`,
  `@AsyncApiMessageBindings`).
- `getAsyncApiDocument()` metadata discovery, DTO and Zod schema generation
  through the `@nestjs/swagger` chain, JSON/YAML serializers, RFC 6901 reference
  helpers, and typed Kafka, NATS, MQTT, and AMQP bindings.
- A migration guide from `nestjs-asyncapi`, validated by a ported sample app, and
  a sample catalog whose every generated document passes `@asyncapi/parser`.

Detailed entries from the development line, rolled into this release:

- Spec-generator skeleton. `getAsyncApiDocument(app, config)` — the AsyncAPI
  counterpart to `SwaggerModule.createDocument` — walks the running
  application's NestJS metadata (the same `ModulesContainer` and
  `MetadataScanner` `@nestjs/swagger` uses for controllers) and emits a valid
  AsyncAPI 3.0 document.
- The `@AsyncApiChannel`, `@AsyncApiPub` / `@AsyncApiSub`, `@AsyncApiMessage`,
  `@AsyncApiHeaders`, and `@AsyncApiServer` decorators that populate channels,
  operations, messages, and servers from handler metadata.
- DTO ↔ JSON Schema integration through the `@nestjs/swagger` chain, with a Zod
  path via `zod-to-json-schema`, and output validated against `@asyncapi/parser`.
- Typed Kafka, NATS, MQTT, and AMQP transport bindings at the server, channel,
  operation, and message scopes, attached with `@AsyncApiChannelBindings`,
  `@AsyncApiOperationBindings`, and `@AsyncApiMessageBindings`.
- The docs route: `AsyncApiModule.setup()` serves the AsyncAPI viewer plus the
  raw JSON and YAML over the application's existing HTTP server, adapter-agnostic
  across Express and Fastify.
- Migration guide from `nestjs-asyncapi`
  (`docs/migration-from-nestjs-asyncapi.md`), mapping every 2.x decorator and the
  `AsyncApiDocumentBuilder` flow onto the AsyncAPI 3.0 model. Validated by
  `sample/05-migration-nestjs-asyncapi`, which ports the `nestjs-asyncapi`
  "felines" sample app and validates the result with `@asyncapi/parser`.
- `escapeJsonPointerSegment` and `buildRef` reference helpers (RFC 6901),
  exported for advanced use, so generated `$ref`s JSON-Pointer-escape each
  segment (`/` → `~1`, `~` → `~0`) — channel ids containing `/`, common when
  channels mirror `@EventPattern` strings such as `ms/create/feline`, resolve and
  pass `@asyncapi/parser` validation.

The published package keeps `"dependencies": {}`. The NestJS packages are
declared as `peerDependencies`, and the AsyncAPI parser, viewer, `@nestjs/swagger`,
and validation libraries are optional peers.

## 0.0.0 - 2026-06-13

### Added

- Initial repository scaffold (`v0.0.1-scaffold` milestone).
- npm workspace skeleton for `@nest-native/asyncapi` with `node:test` + `c8`
  coverage (enforced at 100%), ESLint + SonarJS cognitive-complexity gate
  (threshold `15`), `tsc`-only build, package tarball validation, README link
  validation, and a high-severity supply-chain audit.
- `AsyncApiModule` shell exposing `AsyncApiModule.forRoot()` and
  `AsyncApiModule.forRootAsync()`, each returning a global `DynamicModule` that
  provides the resolved module options. The AsyncAPI decorators
  (`@AsyncApiChannel`, `@AsyncApiPub`, `@AsyncApiSub`, `@AsyncApiMessage`,
  `@AsyncApiHeaders`, `@AsyncApiServer`) and the document generator are
  intentionally not yet implemented.
- CI for build, typecheck, and coverage on Node.js 20 and 22, sticky PR
  comments for coverage, test performance, and cognitive complexity, plus
  release and supply-chain checks.

The published package keeps `"dependencies": {}`. The NestJS packages are
declared as `peerDependencies`, and the AsyncAPI parser and viewer are optional
peers.
