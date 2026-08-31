# Docs Route

`AsyncApiModule.setup()` mirrors `SwaggerModule.setup`: given the document
produced by [`getAsyncApiDocument()`](document-generation.md) and a base route,
it serves the AsyncAPI viewer page plus the raw JSON and YAML on the
application's existing HTTP server.

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

  AsyncApiModule.setup('async-docs', app, document, {
    title: 'Orders Service — AsyncAPI',
  });

  await app.listen(3000);
}
```

This mounts three GET routes:

| Route | Default | Serves |
| --- | --- | --- |
| Viewer page | `/async-docs` | HTML page rendering the AsyncAPI viewer |
| JSON spec | `/async-docs-json` | `application/json` document |
| YAML spec | `/async-docs-yaml` | `application/yaml` document |

`setup()` returns the normalized routes it mounted:
`{ uiUrl, jsonUrl, yamlUrl }`.

## Ordering

Call `setup()` before `app.listen()` (and before any explicit `app.init()`), the
same ordering `SwaggerModule.setup` requires: the routes attach to the HTTP
adapter before the server finalizes its routing table. The document is captured
at setup time, mirroring the generate-on-boot model, so the served spec is
stable for the process lifetime.

Calling `setup()` on an application with no initialized HTTP adapter — for
example a pure microservice — throws an actionable error rather than failing
later, because the docs routes need an HTTP server to attach to.

## Adapter Support

The route handlers are adapter-agnostic. They probe for the response API the
underlying framework exposes and fall back across alternatives, so the same call
works on both `@nestjs/platform-express` and `@nestjs/platform-fastify` without
importing either framework's types.

## Viewer Assets

The page renders with the official
[`@asyncapi/react-component`](https://www.npmjs.com/package/@asyncapi/react-component)
standalone bundle, and by default it loads that script and its stylesheet from a
CDN — the same posture `@nestjs/swagger` takes for swagger-ui assets. That is
what keeps the package at `"dependencies": {}` with no viewer runtime. The spec
itself is embedded inline in the page, so the assets are the only thing the
browser fetches from elsewhere.

That default is a remote dependency at render time. Self-host the two assets and
point `scriptUrl` / `stylesUrl` at your own origin when the deployment has any
of:

- **A strict Content-Security-Policy** — a policy whose `script-src` /
  `style-src` does not allow the CDN blocks the assets, and the viewer renders
  as an empty page.
- **An air-gapped or egress-filtered network** — browsers on it cannot reach the
  CDN at all.
- **Supply-chain requirements** — self-hosting serves the exact bytes you
  vendored and reviewed, instead of trusting a third-party origin on every page
  load.

```ts
AsyncApiModule.setup('async-docs', app, document, {
  scriptUrl: '/assets/asyncapi/standalone.js',
  stylesUrl: '/assets/asyncapi/styles.css',
});
```

Both files come out of an installed `@asyncapi/react-component` —
`browser/standalone/index.js` and `styles/default.min.css` — and are served
however you serve any other static asset (`ServeStaticModule`, a reverse proxy,
or a CDN you control). The defaults are exported as `DEFAULT_VIEWER_SCRIPT_URL`
and `DEFAULT_VIEWER_STYLES_URL`, so the viewer version the page expects is
readable from the package rather than guessed.

The JSON and YAML routes serve the document itself and load nothing remote —
only the viewer page does.

## Options

`AsyncApiDocsOptions` extends the viewer options:

| Option | Purpose |
| --- | --- |
| `jsonDocumentUrl` | Override the JSON route (default `${path}-json`) |
| `yamlDocumentUrl` | Override the YAML route (default `${path}-yaml`) |
| `title` | Title shown on the viewer page |
| `scriptUrl` | Viewer script URL (default: the CDN standalone bundle) |
| `stylesUrl` | Viewer stylesheet URL (default: the CDN stylesheet) |

Routes are normalized to a single leading slash, so passing `docs` or `/docs`
behaves identically.

## Security

The docs route exposes your channels, operations, and message schemas. Treat it
like any other internal surface:

- Guard it with the same auth and network boundaries you apply to internal
  tooling. A spec can leak schema details not meant for unauthenticated readers.
- Keep secrets and internal identifiers out of example payloads and
  `@AsyncApiServer` hosts so they never reach the rendered viewer.
- Treat `@AsyncApiServer` hosts as trusted configuration, not user input.

See [Security](security.md) for the full checklist. For a runnable example, see
[`sample/04-docs-route`](https://github.com/nest-native/asyncapi/tree/main/sample/04-docs-route).
