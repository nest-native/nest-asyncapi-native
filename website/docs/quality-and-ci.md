# Quality And CI

The project reports package quality in three places:

- GitHub step summaries for quick CI scanning.
- Sticky pull request comments for coverage, test performance, and cognitive complexity.
- Uploaded artifacts for raw coverage, test, and complexity data.

## Coverage

Coverage uses `c8` over the package source:

```bash
npm run test:cov
```

The gate requires 100% statements, branches, functions, and lines. The PR
coverage comment compares the pull request against cached base-branch coverage
when base data is available.

CI runs package coverage on Node.js 22 and Node.js 24. The Node.js 22 quality
job owns the PR coverage, performance, and cognitive-complexity comments so those
reports stay single-source.

## Performance

Tests use `node:test`. `npm run test:cov` runs a small reporting wrapper that
writes `test-results.json` with suite and individual test durations parsed from
the runner output.

The PR performance comment shows passed/failed/skipped counts, suite count,
total test step duration, test execution duration, and the slowest suites and
tests. When base data exists, each duration includes a diff against the base
branch.

These numbers are lightweight regression signals, not a synthetic benchmark. Use
them to notice suspicious changes, then inspect the related test or sample.

| Signal | Where it appears | What it means |
| --- | --- | --- |
| Package test step duration | PR performance comment and package quality summary | End-to-end package coverage step |
| Test execution duration | PR performance comment | Time reported by `node:test` for package tests |
| Slowest suites/tests | PR performance comment | Review hints for tests that changed or became slow |
| Sample validation duration | `Sample validation` job summary | Coarse duration for showcase plus focused samples |

## Cognitive Complexity

Cognitive complexity uses SonarJS through ESLint:

```bash
npm run complexity:check
npm run complexity:report
```

`complexity:check` enforces the threshold of `15` per source function.
`complexity:report` writes `complexity/cognitive-complexity-summary.json` with
totals, per-file aggregates, and the most complex functions. The PR comment
treats complexity as a review signal; the hard gate is the ESLint threshold.

## Document Validation

Every sample generates an AsyncAPI 3.0 document and validates it with the
official `@asyncapi/parser`. Parser errors are treated as build failures. This is
the project's definition of a valid spec — the package never claims output is
valid without passing the parser.

## Docs Site

The Docusaurus site is built in CI to catch broken links and build regressions:

```bash
npm run ci:docs
```

`onBrokenLinks` is set to `throw`, so a dangling internal link fails the build.

## Release And Security

Release validation checks README/docs links, sample version sync, and the
package tarball:

```bash
npm run release:check
```

For the publish checklist and version-sync rules, see [Release Guide](release.md).

Supply-chain auditing checks high-severity risk in both the package workspace and
the docs site:

```bash
npm run security:audit
```

Run the complete local gate with:

```bash
npm run ci
```

## Samples

Samples are release blockers. GitHub Actions runs them in the dedicated
`Sample validation` job, and the local gate includes the same matrix:

```bash
npm run ci:sample
```

`release:check` also verifies every `sample/*/package.json` depends on the
current `packages/asyncapi` version and that npm workspace resolution agrees with
the lockfile.
