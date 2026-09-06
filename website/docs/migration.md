# Migration from `nestjs-asyncapi`

If you are moving off the abandoned 2.x
[`nestjs-asyncapi`](https://github.com/flamewow/nestjs-asyncapi), this page
summarizes the move. The full guide lives in the repository at
[`docs/migration-from-nestjs-asyncapi.md`](https://github.com/nest-native/asyncapi/blob/main/docs/migration-from-nestjs-asyncapi.md)
and is validated end-to-end by
[`sample/05-migration-nestjs-asyncapi`](https://github.com/nest-native/asyncapi/tree/main/sample/05-migration-nestjs-asyncapi),
which ports the `nestjs-asyncapi` "felines" sample app and validates the result
with `@asyncapi/parser`.

## Why Migrate

`nestjs-asyncapi` is effectively abandoned: AsyncAPI 3.0 was requested in
December 2023 with no progress, it breaks on current Node and `@nestjs/swagger`,
and users openly ask whether it is maintained. `@nest-native/asyncapi` targets
AsyncAPI 3.0, runs on Node `>=22` and NestJS `11.x` or `12.x`, and keeps the
published package at `"dependencies": {}`.

## The One Conceptual Change

AsyncAPI **2.x** nests a direction (`publish` / `subscribe`) inside a channel.
AsyncAPI **3.0** splits the model: a **channel** is just an address with no
direction, and an **operation** is a `send` or `receive` action that references
a channel.

So the channel is declared **once** at the class level with
`@AsyncApiChannel`, and each method declares **one** operation with
`@AsyncApiPub` (`send`) or `@AsyncApiSub` (`receive`). Note the naming flip:
3.0's `send` is `@AsyncApiPub`, and `receive` is `@AsyncApiSub`.

## Decorator Mapping

| `nestjs-asyncapi` (2.x) | `@nest-native/asyncapi` (3.0) |
| --- | --- |
| `@AsyncApiSub({ channel, message })` on a method | class `@AsyncApiChannel('channel')` + method `@AsyncApiSub()` + `@AsyncApiMessage(Dto)` |
| `@AsyncApiPub({ channel, message })` on a method | class `@AsyncApiChannel('channel')` + method `@AsyncApiPub()` + `@AsyncApiMessage(Dto)` |
| `message: { payload: Dto }` | `@AsyncApiMessage(Dto, { name, summary, ... })` |
| `message: { headers: Dto }` | `@AsyncApiHeaders(Dto)` |
| `message: [{ payload: A }, { payload: B }]` (`oneOf`) | one `@AsyncApiMessage` whose DTO carries `@ApiProperty({ oneOf: [...] })` |
| `new AsyncApiDocumentBuilder()...build()` | a config object passed to `getAsyncApiDocument(app, { title, version, ... })` |
| `.addServers([{ name, server }])` | class `@AsyncApiServer(name, host, protocol, options)` |
| `AsyncApiModule.createDocument(app, options, { include, extraModels })` | `getAsyncApiDocument(app, config)` (discovery walks every module) |
| `await AsyncApiModule.setup(path, app, document)` | `AsyncApiModule.setup(path, app, document, options)` (synchronous) |

## Transport Decorators Are Untouched

`@EventPattern`, `@MessagePattern`, `@SubscribeMessage`, and other transport
decorators stay exactly as they are. This package documents the handler; it never
takes over its transport.

Channel ids that mirror `@EventPattern` strings (for example `ms/create/feline`)
contain `/`. The generator JSON-Pointer-escapes each reference segment per
RFC 6901, so the emitted `$ref`s resolve and pass `@asyncapi/parser` with no
renaming required.

## `forRoot` Is New

`nestjs-asyncapi` had no root module. `@nest-native/asyncapi` keeps the
`getAsyncApiDocument` + `AsyncApiModule.setup` flow and adds
`AsyncApiModule.forRoot()` / `forRootAsync()` for global configuration — import
it in your root module the same way you import `ConfigModule`.

## Polymorphic Payloads

A 2.x `oneOf` of messages becomes one `@AsyncApiMessage` whose DTO uses the
standard `@nestjs/swagger` `@ApiExtraModels` and `@ApiProperty({ oneOf: [...] })`
decorators, because the generator reuses the same schema chain. The full guide
shows the exact before/after.

For the complete step-by-step port, see the
[in-repo migration guide](https://github.com/nest-native/asyncapi/blob/main/docs/migration-from-nestjs-asyncapi.md).
