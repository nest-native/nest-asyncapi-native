# @nest-native/asyncapi

<p align="center">Decorator-first AsyncAPI 3.0 documentation generator for NestJS event-driven services — the AsyncAPI counterpart to @nestjs/swagger.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-native/asyncapi"><img src="https://img.shields.io/npm/v/@nest-native/asyncapi.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@nest-native/asyncapi"><img src="https://img.shields.io/npm/dm/@nest-native/asyncapi.svg" alt="NPM Downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="Package License" /></a>
  <a href="https://nest-native.dev/asyncapi/"><img src="https://img.shields.io/badge/docs-%40nest--native%2Fasyncapi-0f766e.svg" alt="Documentation" /></a>
</p>

> [!NOTE]
> **Status: `0.2.0` (`0.x`).** Functional and fully tested (100% coverage), and
> usable today — but the public API may still change before `1.0`. The public
> API covers: the module (`AsyncApiModule.forRoot()` / `forRootAsync()`), the
> channel and operation decorators (`@AsyncApiChannel`, `@AsyncApiPub`,
> `@AsyncApiSub`), message and header payloads (`@AsyncApiMessage`,
> `@AsyncApiHeaders`) with DTO ↔ JSON Schema generation, document generation
> (`getAsyncApiDocument`), typed transport bindings for Kafka, NATS, MQTT, and
> AMQP (`@AsyncApiServer`, `@AsyncApiChannelBindings`,
> `@AsyncApiOperationBindings`, `@AsyncApiMessageBindings`), and the hosted docs
> route with viewer (`AsyncApiModule.setup`). Every generated document passes the
> official `@asyncapi/parser`. Per semver, `0.x` minor releases can include
> breaking changes, so pin a version — see the
> [support policy](https://github.com/nest-native/asyncapi/blob/main/website/docs/support-policy.md)
> and the [CHANGELOG](../../CHANGELOG.md).

## What This Is

`@nest-native/asyncapi` is a community NestJS integration that makes
AsyncAPI 3.0 documentation feel like a first-class Nest primitive — the
event/message counterpart to `@nestjs/swagger`. You decorate your
`@nestjs/microservices` handlers and message DTOs, and the package generates a
spec-compliant `asyncapi.json` / `asyncapi.yaml` served alongside an AsyncAPI
viewer.

It mirrors the mental model any Nest user already has from documenting an HTTP
API with `@nestjs/swagger`, while staying faithful to AsyncAPI 3.0's
channels/operations/messages separation. It is documentation only — not a
runtime transport.

## Compatibility

| Runtime | Supported line |
| --- | --- |
| Node.js | `>=22` (`>=22.12` to load NestJS 12 from CommonJS) |
| NestJS | `^11.0.0 \|\| ^12.0.0` |
| AsyncAPI spec target | `3.0` (2.x: best-effort conversion only) |
| Transports | Kafka, NATS, MQTT, AMQP (typed bindings) |

The published package has no runtime dependencies. The NestJS packages are
declared as `peerDependencies`, and the AsyncAPI parser and viewer are optional
peers installed only when you need them.

## Installation

```bash
npm i @nest-native/asyncapi
```

Required peers:

```bash
npm i @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Usage

Register the module, then declare channels and operations with decorators.
`@AsyncApiChannel` is the class-level counterpart to `@Controller('path')`, and
`@AsyncApiPub` / `@AsyncApiSub` are the method-level counterparts to the HTTP
verb decorators. `@AsyncApiPub` produces an AsyncAPI 3.0 `send` operation and
`@AsyncApiSub` produces a `receive` operation.

```ts
import { Module } from '@nestjs/common';
import {
  AsyncApiModule,
  AsyncApiChannel,
  AsyncApiPub,
  AsyncApiSub,
} from '@nest-native/asyncapi';

@AsyncApiChannel('orders', { address: 'orders.v1', title: 'Orders' })
class OrdersHandler {
  @AsyncApiPub({ operationId: 'orderPlaced' })
  publishOrderPlaced(): void {}

  @AsyncApiSub({ operationId: 'onOrderShipped' })
  handleOrderShipped(): void {}
}

@Module({
  imports: [
    AsyncApiModule.forRoot({
      defaultInfo: { title: 'Orders Service', version: '1.0.0' },
    }),
  ],
  controllers: [OrdersHandler],
})
export class AppModule {}
```

Generate the document from a running application — the AsyncAPI counterpart to
`SwaggerModule.createDocument`:

```ts
import { getAsyncApiDocument } from '@nest-native/asyncapi';

const document = getAsyncApiDocument(app, {
  title: 'Orders Service',
  version: '1.0.0',
});
```

Channel ids are explicit by design — they are never derived from the class name.
A channel's `address` defaults to its id; pass `address: null` to mark an
address that is unknown at design time, and operation ids default to the
decorated method name.

## Message payloads

Attach a payload (and optional headers) to an operation with `@AsyncApiMessage`
and `@AsyncApiHeaders`. The generated message lands in `components.messages`,
its schemas in `components.schemas`, and the operation references the channel's
message — exactly as AsyncAPI 3.0 prescribes. Every generated document passes
the official [`@asyncapi/parser`](https://www.npmjs.com/package/@asyncapi/parser).

Two validation worlds are supported, mirroring `@nestjs/swagger`'s dual posture:

**class-validator DTOs (default).** Pass a DTO class. The package reuses the
`@nestjs/swagger` chain to turn it into JSON Schema — no parallel reflector — so
install `@nestjs/swagger` as a peer when you use this path.

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import {
  AsyncApiChannel,
  AsyncApiHeaders,
  AsyncApiMessage,
  AsyncApiPub,
} from '@nest-native/asyncapi';

class OrderHeadersDto {
  @ApiProperty()
  @IsUUID()
  traceId!: string;
}

class OrderPlacedDto {
  @ApiProperty()
  @IsUUID()
  id!: string;
}

@AsyncApiChannel('orders', { address: 'orders.v1' })
class OrdersHandler {
  @AsyncApiPub({ operationId: 'orderPlaced' })
  @AsyncApiMessage(OrderPlacedDto, { name: 'OrderPlaced' })
  @AsyncApiHeaders(OrderHeadersDto)
  publishOrderPlaced(): void {}
}
```

**Zod (optional).** Pass a Zod schema directly as a `{ name, schema }` source.
The generator detects it and converts it with Zod 4's native
[`z.toJSONSchema()`](https://zod.dev/json-schema) in the draft-07 dialect
AsyncAPI 3.0 documents default to. `zod` (`^4`) is an optional peer, required
lazily only when a Zod source is registered — never at module load.

```ts
import { z } from 'zod';
import { AsyncApiMessage } from '@nest-native/asyncapi';

const OrderShipped = z.object({ orderId: z.uuid() });

class ShipmentsHandler {
  @AsyncApiSub({ operationId: 'onOrderShipped' })
  @AsyncApiMessage({ name: 'OrderShipped', schema: OrderShipped })
  handleOrderShipped(): void {}
}
```

Need custom conversion options? Convert yourself and pass the result
(`{ name, schema: z.toJSONSchema(OrderShipped, options) }`) — pre-computed
JSON Schema is registered verbatim, so any Zod-to-JSON-Schema converter works.

The message name defaults to the DTO class name (or the schema source `name`),
the content type defaults to `application/json`, and a payload DTO shared across
messages is emitted once under its class name.

## Transport bindings

AsyncAPI 3.0 carries protocol-specific detail in *bindings*. `@nest-native/asyncapi`
ships typed bindings for **Kafka, NATS, MQTT, and AMQP** across all four binding
scopes:

- `@AsyncApiServer(name, host, protocol, options)` — declare a broker (class
  level, repeatable). The `protocol` and server `bindings` carry the transport
  identity and connection metadata.
- `@AsyncApiChannelBindings({ kafka, amqp })` — channel topic/exchange details.
- `@AsyncApiOperationBindings({ kafka, nats, mqtt, amqp })` — consumer groups,
  queue groups, QoS, delivery mode.
- `@AsyncApiMessageBindings({ kafka, mqtt, amqp })` — message wire-format detail.

```ts
import {
  AsyncApiChannel,
  AsyncApiChannelBindings,
  AsyncApiOperationBindings,
  AsyncApiPub,
  AsyncApiServer,
} from '@nest-native/asyncapi';

@AsyncApiServer('kafka', 'kafka.example.com:9092', 'kafka', {
  bindings: { kafka: { schemaRegistryVendor: 'confluent', bindingVersion: '0.5.0' } },
})
@AsyncApiChannel('orders', { address: 'orders.v1' })
@AsyncApiChannelBindings({
  kafka: { topic: 'orders.v1', partitions: 3, bindingVersion: '0.5.0' },
})
class OrdersHandler {
  @AsyncApiPub({ operationId: 'orderPlaced' })
  @AsyncApiOperationBindings({
    kafka: { groupId: { type: 'string' }, bindingVersion: '0.5.0' },
  })
  publishOrderPlaced(): void {}
}
```

The binding maps are typed for the four v1 protocols but stay open, so any other
protocol's spec-compliant binding can be attached verbatim. Bindings are emitted
unchanged, so the official `@asyncapi/parser` remains the source of truth for
what is valid.

## Docs route with viewer

`AsyncApiModule.setup` is the AsyncAPI counterpart to `SwaggerModule.setup`: it
serves the generated document and a live viewer over your application's existing
HTTP server. It mounts three GET routes — the viewer page at `path`, the raw JSON
at `${path}-json`, and the raw YAML at `${path}-yaml` (YAML is the canonical
AsyncAPI interchange format; JSON is offered alongside it).

```ts
import { NestFactory } from '@nestjs/core';
import { AsyncApiModule, getAsyncApiDocument } from '@nest-native/asyncapi';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const document = getAsyncApiDocument(app, {
    title: 'Orders Service',
    version: '1.0.0',
  });
  AsyncApiModule.setup('async-docs', app, document);

  await app.listen(3000);
  // Viewer: http://localhost:3000/async-docs
  // JSON:   http://localhost:3000/async-docs-json
  // YAML:   http://localhost:3000/async-docs-yaml
}
```

Call `setup` before `app.listen()` (the same ordering `SwaggerModule.setup`
requires) so the routes attach before the HTTP server finalizes its routing. It
is adapter-agnostic — it works on `@nestjs/platform-express` and
`@nestjs/platform-fastify` alike.

The viewer page renders with the official
[`@asyncapi/react-component`](https://www.npmjs.com/package/@asyncapi/react-component)
standalone bundle, loaded from a CDN by default so the package ships no viewer
runtime dependency. The spec is embedded inline in the page, so it renders
without a second request. For air-gapped deployments, self-host the assets and
point `scriptUrl` / `stylesUrl` at them; customize the page heading with `title`,
and the spec routes with `jsonDocumentUrl` / `yamlDocumentUrl`.

```ts
AsyncApiModule.setup('async-docs', app, document, {
  title: 'Orders Service — AsyncAPI',
  scriptUrl: '/assets/asyncapi/standalone.js',
  stylesUrl: '/assets/asyncapi/styles.css',
});
```

> **Security.** The generated spec is served unauthenticated by default and may
> reveal channel, schema, and server detail you do not want public. Put the docs
> routes behind your application's existing auth (a guard or a reverse proxy) when
> the document is sensitive, and never place secrets in example payloads.

## Migrating from `nestjs-asyncapi`

Coming from the abandoned 2.x [`nestjs-asyncapi`](https://github.com/flamewow/nestjs-asyncapi)?
The [migration guide](https://github.com/nest-native/asyncapi/blob/main/docs/migration-from-nestjs-asyncapi.md)
maps every 2.x decorator and the `AsyncApiDocumentBuilder` flow onto this
package's 3.0 model, and is validated by porting the `nestjs-asyncapi` sample app
in [`sample/05-migration-nestjs-asyncapi`](https://github.com/nest-native/asyncapi/tree/main/sample/05-migration-nestjs-asyncapi).

## Links

- Source and issues: [github.com/nest-native/asyncapi](https://github.com/nest-native/asyncapi)
- Changelog: [CHANGELOG.md](../../CHANGELOG.md)
- AsyncAPI 3.0 specification: [asyncapi.com](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
- The nest-native family: [@nest-native/drizzle](https://www.npmjs.com/package/@nest-native/drizzle), [@nest-native/trpc](https://www.npmjs.com/package/@nest-native/trpc)
