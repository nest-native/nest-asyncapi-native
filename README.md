# @nest-native/asyncapi

<p align="center">Decorator-first AsyncAPI 3.0 documentation generator for NestJS event-driven services — the AsyncAPI counterpart to @nestjs/swagger.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-native/asyncapi"><img src="https://img.shields.io/npm/v/@nest-native/asyncapi.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@nest-native/asyncapi"><img src="https://img.shields.io/npm/dm/@nest-native/asyncapi.svg" alt="NPM Downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="Package License" /></a>
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen.svg" alt="Test Coverage" />
  <img src="https://img.shields.io/badge/status-0.1.x-blue.svg" alt="Status: 0.1.x" />
  <a href="https://nest-native.dev/asyncapi/"><img src="https://img.shields.io/badge/docs-%40nest--native%2Fasyncapi-0f766e.svg" alt="Documentation" /></a>
</p>

> [!NOTE]
> **Status: `0.1.1` (`0.x`).** Functional and fully tested (100% coverage), and
> usable today — but the public API may still change before `1.0`. The decorator
> set (`@AsyncApiChannel`, `@AsyncApiPub` / `@AsyncApiSub`, `@AsyncApiMessage`,
> `@AsyncApiHeaders`, `@AsyncApiServer`), `getAsyncApiDocument()`, the docs route
> with the AsyncAPI viewer, typed Kafka/NATS/MQTT/AMQP bindings, the
> class-validator and Zod schema paths, a validated migration from
> `nestjs-asyncapi`, and the sample catalog have all landed. The documentation
> site lives under [`website/`](website). Per semver, `0.x` minor releases can
> include breaking changes, so pin a version — see the
> [support policy](website/docs/support-policy.md) and the [CHANGELOG](CHANGELOG.md).

## What This Is

`@nest-native/asyncapi` is a community NestJS integration that generates
[AsyncAPI 3.0](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
documentation for event-driven services. The goal is a decorator-first,
Nest-native experience — the event/message counterpart to `@nestjs/swagger` for
HTTP. You decorate your `@nestjs/microservices` handlers and message DTOs, and
the package walks the same NestJS metadata `@nestjs/swagger` uses to emit a
spec-compliant `asyncapi.json` / `asyncapi.yaml`, served alongside an AsyncAPI
viewer.

It uses AsyncAPI spec primitives only; it does not hide AsyncAPI semantics
behind a facade. It is documentation only — not a runtime transport.

## Why

AsyncAPI documentation for NestJS is effectively unserved today:

- `nestjs-asyncapi` is the de-facto generator and is effectively abandoned:
  AsyncAPI 3.0 was requested in Dec 2023 with no progress
  ([`#518`](https://github.com/flamewow/nestjs-asyncapi/issues/518)), it breaks
  on current Node and `@nestjs/swagger`
  ([`#596`](https://github.com/flamewow/nestjs-asyncapi/issues/596)), and users
  openly ask whether it is still maintained
  ([`#578`](https://github.com/flamewow/nestjs-asyncapi/issues/578)).
- There is no official `@nestjs/asyncapi` to replace it.

This package's headline differentiators:

- **AsyncAPI 3.0 native** — built around the channels/operations/messages model
  that 3.0 introduced, not a 2.x port.
- **`@nestjs/swagger` mental model** — the same decorator-first, generate-on-build
  flow any Nest user already knows from documenting an HTTP API.
- **Validated output** — every generated spec is treated as valid only when it
  passes the official `@asyncapi/parser`.
- **A working docs route** — the viewer comes wired, not "bring your own".

## Compatibility

| Runtime | Supported line |
| --- | --- |
| Node.js | `>=22` |
| NestJS | `11.x` |
| AsyncAPI spec target | `3.0` (2.x: best-effort conversion only) |
| Transports | Kafka, NATS, MQTT, AMQP (typed protocol bindings) |
| Validation | Zod and class-validator, both app-owned |

The published package keeps `"dependencies": {}`. The NestJS packages are
declared as `peerDependencies`, and the AsyncAPI parser and viewer are optional
peers, so applications install only the ecosystems they actually use.

## Repository Layout

This repository contains:

- [`packages/asyncapi`](packages/asyncapi): the `@nest-native/asyncapi` integration package
- [`sample`](sample): runnable sample apps, each validated against `@asyncapi/parser`
- [`website`](website): the Docusaurus documentation site
- [`docs`](docs): the in-repo migration guide
- [`scripts`](scripts): quality, coverage, complexity, and release-check helpers
- [`CONTRIBUTING.md`](CONTRIBUTING.md): contributor workflow, including the
  sample/library PR separation rule
- [`CHANGELOG.md`](CHANGELOG.md): release history and unreleased changes
- [`SECURITY.md`](SECURITY.md): vulnerability reporting and project security boundaries

## Installation

```bash
npm i @nest-native/asyncapi
```

Required peers:

```bash
npm i @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Usage

Register the module to wire global configuration:

```ts
import { Module } from '@nestjs/common';
import { AsyncApiModule } from '@nest-native/asyncapi';

@Module({
  imports: [
    AsyncApiModule.forRoot({
      defaultInfo: { title: 'Orders Service', version: '1.0.0' },
    }),
  ],
})
export class AppModule {}
```

Async configuration is supported through `AsyncApiModule.forRootAsync()`:

```ts
AsyncApiModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    defaultInfo: { title: config.getOrThrow('SERVICE_NAME') },
  }),
});
```

Both registrations return a global `DynamicModule` by default. Pass
`isGlobal: false` to scope it to a single module boundary.

### Decorating a handler

Declare the channel at the class level and operations at the method level:

```ts
import { Controller } from '@nestjs/common';
import {
  AsyncApiChannel,
  AsyncApiMessage,
  AsyncApiPub,
  AsyncApiSub,
} from '@nest-native/asyncapi';
import { OrderPlacedDto } from './order.dto';

@Controller()
@AsyncApiChannel('orders', { address: 'orders.v1' })
export class OrdersHandler {
  @AsyncApiPub({ operationId: 'orderPlaced' })
  @AsyncApiMessage(OrderPlacedDto)
  publishOrderPlaced(): void {}

  @AsyncApiSub({ operationId: 'onOrderPlaced' })
  @AsyncApiMessage(OrderPlacedDto)
  handleOrderPlaced(): void {}
}
```

### Generating and serving a document

`getAsyncApiDocument()` is the AsyncAPI counterpart to
`SwaggerModule.createDocument`. It walks the running application's NestJS
metadata — the same `ModulesContainer` and `MetadataScanner` `@nestjs/swagger`
uses for controllers — and returns a spec-compliant AsyncAPI 3.0 document.
`AsyncApiModule.setup()` then serves the viewer plus the raw JSON and YAML,
mirroring `SwaggerModule.setup`:

```ts
import { NestFactory } from '@nestjs/core';
import { AsyncApiModule, getAsyncApiDocument } from '@nest-native/asyncapi';

const app = await NestFactory.create(AppModule);

const document = getAsyncApiDocument(app, {
  title: 'Orders Service',
  version: '1.0.0',
});

AsyncApiModule.setup('async-docs', app, document);
await app.listen(3000);
// Viewer: http://localhost:3000/async-docs
//   JSON: http://localhost:3000/async-docs-json
//   YAML: http://localhost:3000/async-docs-yaml
```

For the full API — every decorator, transport bindings, the class-validator and
Zod schema paths, and the docs-route options — see the
[documentation site](website) and the [samples](sample).

## Migrating from `nestjs-asyncapi`

If you are moving off the abandoned 2.x
[`nestjs-asyncapi`](https://github.com/flamewow/nestjs-asyncapi), the
[migration guide](docs/migration-from-nestjs-asyncapi.md) maps every 2.x
decorator and the `AsyncApiDocumentBuilder` flow onto this package's AsyncAPI 3.0
model. It is validated end-to-end by porting the `nestjs-asyncapi` "felines"
sample app in
[`sample/05-migration-nestjs-asyncapi`](sample/05-migration-nestjs-asyncapi),
whose smoke test asserts the migration is faithful and validates the result with
the official `@asyncapi/parser`.

## Quality Gates

The repository ships the same review posture as its sibling `@nest-native`
packages, using `node:test` and `c8`:

- package build, typecheck, and coverage on Node.js 22 and 24
- coverage with `c8`, enforced at 100% for statements, branches, functions, and lines
- sticky PR comments for coverage, test performance, and cognitive complexity
- cognitive complexity enforcement with SonarJS threshold `15`
- package tarball validation and README/docs link validation
- a Docusaurus docs-site build (`onBrokenLinks: throw`)
- supply-chain audit for high-severity issues, across the package and docs site
- a sample matrix where every generated document passes `@asyncapi/parser`

Run the local gate with:

```bash
npm run ci
```

One **optional, local-only** layer sits on top (it never runs in CI, and forks
work without it):

- **Mutation testing** — `npm run test:mutation` (incremental Stryker run;
  `test:mutation:full` re-tests everything). Scope with `STRYKER_MUTATE`
  (comma-separated globs).

Details — including the pre-PR ritual and agent instructions — in
[GUIDELINES_NEST_ASYNCAPI.md](GUIDELINES_NEST_ASYNCAPI.md#13-mutation-testing-stryker--local-only-never-in-ci).

## Status and Roadmap

`v0.1.0` was the first public release. The initial `0.x` release covers every
milestone below:

1. ~~**Bootstrap** — repo skeleton, empty package, CI green.~~ ✅
2. ~~Spec generator skeleton: walks NestJS metadata, emits an empty valid 3.0 doc.~~ ✅
3. ~~`@AsyncApiChannel` + `@AsyncApiPub` / `@AsyncApiSub` with a showcase sample.~~ ✅
4. ~~DTO ↔ JSON Schema integration, validated against `@asyncapi/parser`.~~ ✅
5. ~~Transport bindings for Kafka, NATS, MQTT, AMQP.~~ ✅
6. ~~Docs route with the AsyncAPI viewer.~~ ✅
7. ~~Migration guide from `nestjs-asyncapi`.~~ ✅
8. ~~Documentation site. Release `v0.1`.~~ ✅ (current)

See [CHANGELOG.md](CHANGELOG.md) for what has landed, and the
[roadmap](website/docs/roadmap.md) for the project's boundaries going forward.

## License

[MIT](LICENSE) © 2026 Rodrigo Nogueira.

Part of the [nest-native](https://github.com/nest-native) family, alongside
[@nest-native/drizzle](https://github.com/nest-native/drizzle) and
[@nest-native/trpc](https://github.com/nest-native/trpc).
