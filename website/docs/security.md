# Security

`@nest-native/asyncapi` generates documentation that can describe internal
schemas and broker locations, and ships an optional viewer that renders that
document. Security review covers both the supply chain and the application
surface.

## Docs Route Auth Boundaries

The docs route exposes channels, operations, and message schemas. A spec can
leak schema details that are not intended for unauthenticated readers.

- Guard the docs route with the same authentication and network boundaries you
  apply to other internal tooling.
- Do not assume the route is harmless because it is "just documentation" — it is
  a description of your event contract.
- Consider serving it only in non-production environments, or behind an internal
  gateway, when the contract is sensitive.

## XSS In Rendered Content

The viewer renders the generated document. Keep the inputs trustworthy:

- Treat titles, descriptions, and example values as content that will be
  rendered. Do not inject unsanitized user input into the document before
  serving it.
- The viewer assets are reviewed for size and supply-chain risk at every update.

## No Secrets In Generated Output

The generated spec is derived from decorator metadata and DTOs. Keep secrets
out of it:

- No secrets, tokens, or credentials in example payloads or DTO defaults.
- No internal identifiers in message names, channel ids, or descriptions that
  should not be public.
- No connection secrets in `@AsyncApiServer` hosts — declare hosts, not
  credentials.

## URL Injection In Server Configurations

`@AsyncApiServer` hosts and `pathname` values are emitted into the document and
rendered by the viewer.

- Treat `@AsyncApiServer` hosts as trusted configuration, not user input.
- Do not build server hosts from request data or other untrusted sources.

## Supply-Chain Posture

Supply-chain checks are non-negotiable:

- The published `packages/asyncapi/package.json` keeps `"dependencies": {}`
  empty. Runtime libraries are peers; build and test tools are devDependencies.
- Every dependency addition or update is reviewed for legitimacy, lifecycle
  scripts, and unpinned Git or URL sources.
- The viewer bundle is reviewed for size and supply-chain risk on every update.
- The viewer page loads its script and stylesheet from a CDN by default. Self-host
  them through `scriptUrl` / `stylesUrl` when a strict Content-Security-Policy, an
  air-gapped network, or a supply-chain policy rules out a third-party origin —
  see [Viewer Assets](docs-route.md#viewer-assets).

Run the high-severity audit locally:

```bash
npm run security:audit
```

## Reporting

Report suspected vulnerabilities privately through the repository's
[`SECURITY.md`](https://github.com/nest-native/asyncapi/blob/main/SECURITY.md)
process rather than opening a public issue.
