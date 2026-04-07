# Changelog

## Unreleased

- Added dependency search that works together with the existing status filters.
- Added monorepo version drift detection for the same dependency across multiple package manifests.
- Added bulk safe upgrades for the currently visible dependency list.
- Expanded docs and release planning for the upcoming `0.2.0` release.

## 0.1.0

- Added major-aware upgrade flows with `ask`, `safe`, and `latest` strategies.
- Added an explicit latest-major upgrade action through inline icons and the context menu.
- Improved outdated detection so ranges like `^1.7.10` still surface newer patch and minor upgrades.
- Refreshed Marketplace screenshots and upgrade-action documentation.

## 0.0.1

- Added a dedicated Activity Bar entry for dependency inspection.
- Added latest-version lookup and per-package upgrade actions.
- Added support for `npm`, `pnpm`, `yarn`, and `bun`.
- Added monorepo support for multiple `package.json` manifests.
- Added dependency status filtering and upgrade range settings.
- Added unit tests, Extension Host integration tests, and local VSIX packaging validation.
