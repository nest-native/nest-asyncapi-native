#!/usr/bin/env node

// Prints which NestJS major every workspace in this repo actually resolves and
// fails unless all of them resolve the requested one, from the root
// `node_modules`. Two gates run it:
//
// - `release:check` runs it with the default install's major (11). A
//   workspace-nested `@nestjs/*` copy means the lockfile drifted from what the
//   workspace declares — every sample pins exactly the versions the root
//   resolves — so the samples silently exercise a different NestJS than the
//   package suite. That is what happened when dependabot bumped the sample
//   manifests to `@nestjs/swagger` 11.4.7 while the lockfile kept a nested
//   11.4.4 under every sample, and the nested copy's `^11` peer then made
//   the NestJS 12 leg ERESOLVE before anything ran.
// - the NestJS 12 compatibility leg runs it with 12 after its `--no-save`
//   install: npm nests an older copy under a workspace whenever that
//   workspace's own range is not satisfied by the hoisted version, and a
//   suite or a sample that passes against a mixed 11/12 tree proves nothing
//   about 12.
//
// Every workspace is checked for `@nestjs/common` and `@nestjs/core`, plus
// every other `@nestjs/*` package that workspace declares itself (the samples
// pin `@nestjs/swagger`, `@nestjs/platform-express`, and — for the migration
// sample — `@nestjs/microservices`), so a sample that generated its document
// through a nested `@nestjs/swagger` cannot pass as a run on the claimed major.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const alwaysChecked = ['@nestjs/common', '@nestjs/core'];
const expectedMajor =
  process.argv[2] === undefined
    ? majorDeclaredByDevDependency('@nestjs/core')
    : Number(process.argv[2]);

if (!Number.isInteger(expectedMajor)) {
  console.error('Usage: node scripts/check-resolved-nestjs-major.mjs [major]');
  console.error(
    'Without an argument the major comes from the root devDependency on @nestjs/core.',
  );
  process.exit(1);
}

const failures = [];

for (const workspaceDir of ['.', ...collectWorkspaceDirs()]) {
  const manifestPath = path.join(repoRoot, workspaceDir, 'package.json');
  const require = createRequire(manifestPath);

  for (const packageName of collectCheckedPackages(manifestPath)) {
    const { version, packageDir } = resolveInstalled(require, packageName);
    const major = Number(version.split('.')[0]);
    const location = path.relative(repoRoot, packageDir);
    const hoistedLocation = path.join('node_modules', packageName);

    console.log(
      `${workspaceDir.padEnd(36)} ${packageName.padEnd(26)} ${version.padEnd(8)} <- ${location}`,
    );

    if (major !== expectedMajor) {
      failures.push(
        `${workspaceDir} resolves ${packageName}@${version}; expected major ${expectedMajor}`,
      );
    } else if (location !== hoistedLocation) {
      failures.push(
        `${workspaceDir} resolves ${packageName}@${version} from a nested copy at ${location}; ` +
          `expected the hoisted ${hoistedLocation} — the lockfile drifted from what the workspace declares`,
      );
    }
  }
}

if (failures.length > 0) {
  throw new Error(`NestJS resolution check failed:\n${failures.join('\n')}`);
}

console.log(`Every workspace resolves NestJS ${expectedMajor} from the root node_modules.`);

function majorDeclaredByDevDependency(packageName) {
  const rootManifest = readJson(path.join(repoRoot, 'package.json'));
  const range = rootManifest.devDependencies?.[packageName];
  const major = /^\D*(\d+)\./.exec(range ?? '')?.[1];

  if (major === undefined) {
    throw new Error(
      `Cannot derive a major from the root devDependency ${packageName}@${range ?? '<missing>'}`,
    );
  }

  return Number(major);
}

function collectCheckedPackages(manifestPath) {
  const manifest = readJson(manifestPath);
  const declared = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  }).filter(name => name.startsWith('@nestjs/'));

  return [...new Set([...alwaysChecked, ...declared])].sort();
}

function resolveInstalled(require, packageName) {
  // `require('<pkg>/package.json')` is not an option: the NestJS 12 exports
  // map routes `./*` to `./*.js`, so walk up from the resolved entry point to
  // the manifest that declares the package instead.
  const entryPoint = require.resolve(packageName);
  let packageDir = path.dirname(entryPoint);

  for (;;) {
    const manifestPath = path.join(packageDir, 'package.json');

    if (fs.existsSync(manifestPath)) {
      const manifest = readJson(manifestPath);

      if (manifest.name === packageName) {
        return { version: manifest.version, packageDir };
      }
    }

    const parentDir = path.dirname(packageDir);

    if (parentDir === packageDir) {
      throw new Error(`No package.json for ${packageName} above ${entryPoint}`);
    }

    packageDir = parentDir;
  }
}

function collectWorkspaceDirs() {
  const rootManifest = readJson(path.join(repoRoot, 'package.json'));

  return (rootManifest.workspaces ?? []).flatMap(pattern => {
    const baseDir = pattern.replace(/\/\*$/, '');
    const absoluteBaseDir = path.join(repoRoot, baseDir);

    if (!fs.existsSync(absoluteBaseDir)) {
      return [];
    }

    return fs
      .readdirSync(absoluteBaseDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(baseDir, entry.name))
      .filter(workspaceDir =>
        fs.existsSync(path.join(repoRoot, workspaceDir, 'package.json')),
      )
      .sort();
  });
}

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}
