# Publish strategy

## Recommendation (one line)

**Publish this monorepo as three npm packages (`@nikomohr/goal-core`, `@nikomohr/goal-cli`, `@nikomohr/opencode-goal`); keep `cursor-goal` as a separate repo that can share `@nikomohr/goal-core` from npm over time.**

## Rationale

| Option | Pros | Cons |
|--------|------|------|
| **A. Monorepo publish (chosen)** | Single source of truth for verify gate + checkpoint; OpenCode plugin and Cursor CLI stay aligned; semver one place | Three packages to release |
| B. Merge goal-core into cursor-goal | One fewer repo | Duplicates logic already extracted; OpenCode plugin would fork or depend on cursor-goal (wrong boundary) |

`repos/cursor-goal` and `repos/opencode-goal` remain **reference clones** for parity only (gitignored in this repo).

## Package names and versioning

| Package | npm name | Version | Consumer |
|---------|----------|---------|----------|
| Core | `@nikomohr/goal-core` | `0.2.0` | CLI, plugin, wrappers |
| CLI | `@nikomohr/goal-cli` | `0.2.0` | Humans, CI, agents |
| OpenCode plugin | `@nikomohr/opencode-goal` | `0.2.0` | `opencode.json` `plugin` array |

**Versioning:** Independent semver per package, but **lockstep minor** for breaking checkpoint/schema changes in goal-core (bump all dependents in same release). Patch-only fixes can ship goal-core alone.

**Possible cursor-goal dependency:**

```json
"dependencies": {
  "@nikomohr/goal-core": "^0.2.0"
}
```

Keep Cursor-specific command handling in that repo.

## Publish-ready metadata (done in package.json)

- `name`, `version`, `files`, `exports` set per package
- `publishConfig.access: public`
- `repository.directory` for monorepo subpath
- goal-core ships **`dist/` only** (not `src/`) in the tarball
- goal-cli ships **`dist/`** + bin map
- opencode-goal ships **`src/`** (Bun-native TS entry)

## Dry-run pack (no publish)

```bash
cd packages/goal-core && npm pack --dry-run
cd ../goal-cli && npm pack --dry-run
cd ../opencode-goal && npm pack --dry-run
```

Actual publish:

```bash
npm publish -w @nikomohr/goal-core --access public
npm publish -w @nikomohr/goal-cli --access public
npm publish -w @nikomohr/opencode-goal --access public
```

## OpenCode config after publish

```json
{
  "plugin": ["@nikomohr/opencode-goal"]
}
```

Local dev continues to use `file:///…/packages/opencode-goal` per [INSTALL-OPENCODE.md](./INSTALL-OPENCODE.md).
