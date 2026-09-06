# Support Policy

`@nest-native/asyncapi` is a community package and does not claim official NestJS
or AsyncAPI status.

## Supported Runtime Lines

| Runtime | Supported line |
| --- | --- |
| Node.js | `>=22` |
| NestJS | `^11.0.0 \|\| ^12.0.0` |
| AsyncAPI spec target | `3.0` (2.x: best-effort conversion only) |
| TypeScript | Current project compiler line |

Required peers are `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, and
`rxjs`. The AsyncAPI parser, the viewer, `@nestjs/swagger`, `class-validator`,
and `zod` are optional peers — install only the ecosystems your application uses.

NestJS 12 is ESM-only. A CommonJS application loads it through `require(esm)`,
which needs Node `>=22.12`; 12 also runs lifecycle hooks by component hierarchy
level rather than registration order, which this package never depended on.
Both ends of the NestJS range are tested: the default install and lockfile stay
on 11, and the `nestjs-latest-major` CI leg installs the 12 set on top, proves
every workspace resolved 12, and re-runs the suite, the build, and the full
sample matrix — including the `@nestjs/swagger` schema chain and the
`@nestjs/microservices` migration sample — against it. When you document DTOs
on NestJS 12, install `@nestjs/swagger` 12 alongside: its own peer range
requires `@nestjs/common` and `@nestjs/core` 12.

## Public API Tiers

Primary application APIs:

- `AsyncApiModule.forRoot()` / `forRootAsync()` / `setup()`
- `@AsyncApiChannel()`
- `@AsyncApiPub()` / `@AsyncApiSub()`
- `@AsyncApiMessage()` / `@AsyncApiHeaders()`
- `@AsyncApiServer()`
- `getAsyncApiDocument()`

Binding APIs:

- `@AsyncApiChannelBindings()` / `@AsyncApiOperationBindings()` / `@AsyncApiMessageBindings()`
- `AsyncApiProtocol` and the typed binding interfaces

Advanced integration APIs:

- `buildAsyncApiDocument()`
- `AsyncApiSchemaRegistry`
- `toJson()` / `toYaml()` serializers
- `escapeJsonPointerSegment()` / `buildRef()` reference helpers

Prefer primary APIs in normal application code. Use advanced APIs only when an
external integration or focused test needs the exact internal contract.

## Dependency Policy

The published package keeps `"dependencies": {}` empty. Runtime integrations
belong in `peerDependencies`, and package-local build/test tools belong in
`devDependencies`.

This avoids pulling a second Nest runtime, a surprise AsyncAPI parser, a heavy
viewer bundle, or an unused validation stack into host applications.

## Security Expectations

Security review should cover:

- dependency additions and lockfile churn
- install and lifecycle scripts on every dependency change
- docs-route authentication boundaries
- XSS in the rendered viewer content
- secret leakage in docs, samples, example payloads, and tests
- URL injection in `@AsyncApiServer` configurations

High-risk findings should block merge until they are mitigated or explicitly
accepted by maintainers. See [Security](security.md).
