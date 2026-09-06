# Migrating from `nestjs-asyncapi`

This guide ports an application from
[`nestjs-asyncapi`](https://github.com/flamewow/nestjs-asyncapi) (the de-facto
AsyncAPI **2.x** generator for NestJS) to `@nest-native/asyncapi` (AsyncAPI
**3.0** native). It is validated end-to-end: the
[`sample/05-migration-nestjs-asyncapi`](../sample/05-migration-nestjs-asyncapi)
sample is the `nestjs-asyncapi` "felines" example app ported to this package, and
its smoke test asserts the migrated document reproduces the original's channels,
operations, polymorphic payload, and server, then validates it with the official
`@asyncapi/parser`.

## Why migrate

`nestjs-asyncapi` is effectively abandoned: AsyncAPI 3.0 was requested in
December 2023 with no progress
([`#518`](https://github.com/flamewow/nestjs-asyncapi/issues/518)), it breaks on
current Node and `@nestjs/swagger`
([`#596`](https://github.com/flamewow/nestjs-asyncapi/issues/596)), and users
openly ask whether it is maintained
([`#578`](https://github.com/flamewow/nestjs-asyncapi/issues/578)).
`@nest-native/asyncapi` targets AsyncAPI 3.0, runs on Node `>=22` and NestJS
`11.x` or `12.x`, and keeps the published package at `"dependencies": {}`.

## The one conceptual change: 2.x channels → 3.0 channels + operations

This is the only idea you must internalize; everything else is a mechanical
rename.

AsyncAPI **2.x** nests a direction (`publish` / `subscribe`) *inside* a channel.
`nestjs-asyncapi` mirrors that: each method stacks `@AsyncApiSub` / `@AsyncApiPub`
(its 2.x decorators) and every decorator repeats its own `{ channel, message }`.

AsyncAPI **3.0** splits the model in two:

- a **channel** is just an address (a topic, queue, or `@EventPattern` string) —
  it has no direction;
- an **operation** is a `send` or `receive` action that *references* a channel.

So in `@nest-native/asyncapi` the channel is declared **once** at the class level,
and each method declares **one operation**. (Note the naming flip below: 3.0's
`send` operation is the `@AsyncApiPub` decorator; `receive` is `@AsyncApiSub`.)

## Decorator and API mapping

| `nestjs-asyncapi` (2.x) | `@nest-native/asyncapi` (3.0) |
| --- | --- |
| `@AsyncApiSub({ channel, message })` on a method (a 2.x *subscribe* — the app **receives**) | class-level `@AsyncApiChannel('channel')` + method-level `@AsyncApiSub()` + `@AsyncApiMessage(Dto)` |
| `@AsyncApiPub({ channel, message })` on a method (a 2.x *publish* — the app **sends**) | class-level `@AsyncApiChannel('channel')` + method-level `@AsyncApiPub()` + `@AsyncApiMessage(Dto)` |
| `message: { payload: Dto }` | `@AsyncApiMessage(Dto, { name, summary, ... })` |
| `message: { headers: Dto }` | `@AsyncApiHeaders(Dto)` |
| `message: [{ payload: A }, { payload: B }]` (a `oneOf` of messages) | one `@AsyncApiMessage` whose DTO carries an `@ApiProperty({ oneOf: [...] })` payload (see [Polymorphic payloads](#polymorphic-payloads)) |
| `new AsyncApiDocumentBuilder().setTitle(...).setVersion(...).build()` | a plain config object passed to `getAsyncApiDocument(app, { title, version, ... })` |
| `.addServers([{ name, server }])` on the builder | class-level `@AsyncApiServer(name, host, protocol, options)` |
| `.addSecurity(...)`, `.setDefaultContentType(...)` on the builder | `contentType` per `@AsyncApiMessage`; security via spec primitives on the document |
| `extraModels: [A, B]` on `createDocument` | `@ApiExtraModels(A, B)` on the DTO (standard `@nestjs/swagger`) |
| `AsyncApiModule.createDocument(app, options, { include, extraModels })` | `getAsyncApiDocument(app, config)` — discovery walks every module; no `include` |
| `await AsyncApiModule.setup(path, app, document)` | `AsyncApiModule.setup(path, app, document, options)` (synchronous) |

### `forRoot` is new, not a replacement

`nestjs-asyncapi` had no root module; you only called `createDocument` at
bootstrap. `@nest-native/asyncapi` keeps that flow (`getAsyncApiDocument` +
`AsyncApiModule.setup`) but adds `AsyncApiModule.forRoot()` /
`forRootAsync()` for global configuration — import it in your root module the
same way you import `ConfigModule`.

## Step-by-step

### 1. Swap the dependency

```bash
npm rm nestjs-asyncapi
npm i @nest-native/asyncapi
# peers you almost certainly already have:
npm i @nestjs/common @nestjs/core reflect-metadata rxjs
# optional peers, installed only for what you use:
npm i @nestjs/swagger          # class-validator / @ApiProperty DTO schemas
npm i @asyncapi/parser         # validate the generated document in tests/CI
```

The published package keeps `"dependencies": {}`; you install only the
ecosystems you actually use.

### 2. Lift the channel up, split the operations

Before (`nestjs-asyncapi`, a microservice controller):

```ts
@Controller()
export class FelinesController {
  @AsyncApiSend({ channel: 'ms/create/feline', message: { payload: CreateFelineDto } })
  @AsyncApiReceive({ channel: 'ms/create/feline', message: { payload: FelineRto } })
  @EventPattern('ms/create/feline')
  async createFeline(dto: CreateFelineDto) { /* ... */ }
}
```

After (`@nest-native/asyncapi`):

```ts
@Controller()
@AsyncApiChannel('ms/create/feline', { title: 'Create feline' })
export class CreateFelineController {
  @AsyncApiPub({ operationId: 'publishCreateFeline' })
  @AsyncApiMessage(FelineEventDto, { name: 'FelineEvent' })
  publishCreateFeline(): void {}

  @AsyncApiSub({ operationId: 'onCreateFeline' })
  @AsyncApiMessage(FelineEventDto, { name: 'FelineEvent' })
  @EventPattern('ms/create/feline')
  handleCreateFeline(event: FelineEventDto): void { /* ... */ }
}
```

The `@EventPattern` (and `@MessagePattern`, `@SubscribeMessage`, …) transport
decorators are untouched — `@nest-native/asyncapi` **documents** the handler and
never takes over its transport.

> **Channel ids with slashes just work.** Microservice channels mirror the
> `@EventPattern` string (`ms/create/feline`), which contains `/`. The generator
> JSON-Pointer-escapes each reference segment (`/` → `~1`, per RFC 6901), so the
> emitted `$ref`s resolve and pass `@asyncapi/parser`. No renaming required.

### 3. Replace the document builder

Before:

```ts
const options = new AsyncApiDocumentBuilder()
  .setTitle('Feline')
  .setVersion('1.0')
  .setDefaultContentType('application/json')
  .addServers([{ name: 'europe', server: asyncApiServer }])
  .build();

return AsyncApiModule.createDocument(app, options, {
  include: [FelinesModule],
  extraModels: [Cat, Lion, Tiger, Feline],
});
```

After:

```ts
// Servers move onto the handler as @AsyncApiServer(...) (see step 4).
// extraModels move onto the DTO as @ApiExtraModels(...) (see Polymorphic payloads).
return getAsyncApiDocument(app, {
  title: 'Feline',
  version: '1.0.0',
  description: 'Feline events.',
});
```

### 4. Move servers onto the handler

The builder's `addServers` becomes the repeatable class-level `@AsyncApiServer`
decorator, which carries the transport identity (`protocol`) and connection
metadata (`bindings`):

```ts
@Controller()
@AsyncApiServer('felines-broker', 'tcp://localhost:4001', 'tcp', {
  title: 'Felines microservice',
})
@AsyncApiChannel('ms/create/feline')
export class CreateFelineController { /* ... */ }
```

### 5. Serve the docs (unchanged in shape)

```ts
const app = await NestFactory.create(AppModule);
const document = getAsyncApiDocument(app, { title: 'Feline', version: '1.0.0' });
AsyncApiModule.setup('async-api', app, document, { title: 'Feline — AsyncAPI' });
await app.listen(4001);
```

`AsyncApiModule.setup` mounts the viewer at the path plus the raw JSON and YAML
at `${path}-json` / `${path}-yaml`. It is synchronous here (the 2.x version was
`await`ed); both spellings compile, so dropping the `await` is optional.

## Polymorphic payloads

The `nestjs-asyncapi` sample documents a polymorphic `Feline` payload — a `oneOf`
of `Cat` / `Lion` / `Tiger` — and registers the concrete classes through the
builder's `extraModels`. `@nest-native/asyncapi` reuses the **same**
`@nestjs/swagger` schema chain, so the migration is two standard `@nestjs/swagger`
decorators:

```ts
@ApiExtraModels(Cat, Lion, Tiger)
export class FelineEventDto {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(Cat) },
      { $ref: getSchemaPath(Lion) },
      { $ref: getSchemaPath(Tiger) },
    ],
  })
  payload!: Feline;
}
```

`@ApiExtraModels(...)` is the per-DTO equivalent of the builder's `extraModels`:
it tells the `@nestjs/swagger` chain to emit `Cat`, `Lion`, and `Tiger` into
`components.schemas` so the `getSchemaPath(...)` references resolve. Without it,
`oneOf` references to classes that are not otherwise reachable are dangling — the
same gotcha existed in 2.x, which is exactly why the original sample passed
`extraModels`.

## What does not carry over (v1 scope)

- **AsyncAPI 2.x output.** `@nest-native/asyncapi` is 3.0 native. There is no 2.x
  emit mode.
- **WebSocket gateways.** The `nestjs-asyncapi` sample also documents a
  `@WebSocketGateway`. v1 of this package focuses on `@nestjs/microservices`
  handlers and the Kafka/NATS/MQTT/AMQP bindings; document a gateway by treating
  its message name as a channel and attaching the payload DTO exactly as above.
- **`include` filtering.** Discovery walks every module in the running
  application. Structure your modules so only the intended handlers carry AsyncAPI
  decorators; undecorated providers and controllers contribute nothing.

## Validate the result

Treat a generated document as correct only when it passes the official parser —
the same bar this package holds itself to:

```ts
import { Parser } from '@asyncapi/parser';

const { diagnostics } = await new Parser().parse(
  JSON.parse(JSON.stringify(document)),
);
const errors = diagnostics.filter((d) => d.severity === 0);
if (errors.length > 0) {
  throw new Error(errors.map((d) => d.message).join('\n'));
}
```

The ported sample's
[`scripts/smoke.ts`](../sample/05-migration-nestjs-asyncapi/scripts/smoke.ts)
does exactly this, and CI runs it on every change.
