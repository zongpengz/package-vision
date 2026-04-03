import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildUpgradeCommand,
  createPackageManagerExecutionContext,
  walkUpDirectories
} from "../src/services/packageManagerCore";
import { DependencyRecord, PackageManifestRecord } from "../src/models/dependency";

function createManifest(
  overrides: Partial<PackageManifestRecord> = {}
): PackageManifestRecord {
  return {
    id: "file:///repo/package.json",
    workspaceFolderName: "workspace",
    workspaceFolderUri: "/repo",
    packageJsonPath: "/repo/package.json",
    packageDirPath: "/repo",
    displayName: "workspace",
    relativeDirPath: ".",
    isWorkspaceRootPackage: true,
    ...overrides
  };
}

function createDependency(
  overrides: Partial<DependencyRecord> = {}
): DependencyRecord {
  return {
    name: "react",
    section: "dependencies",
    declaredVersion: "^18.0.0",
    packageManifest: createManifest(),
    status: "unknown",
    ...overrides
  };
}

test("createPackageManagerExecutionContext marks nested packages as monorepo targets", () => {
  const context = createPackageManagerExecutionContext(
    {
      packageManager: "pnpm",
      managerRootPath: "/repo"
    },
    "/repo/packages/web"
  );

  assert.equal(context.isMonorepoPackage, true);
  assert.equal(context.commandCwdPath, "/repo");
  assert.equal(context.workspaceTarget, "packages/web");
  assert.equal(context.workspaceFilter, "./packages/web");
});

test("buildUpgradeCommand creates an npm workspace command for nested devDependencies", () => {
  const dependency = createDependency({
    section: "devDependencies",
    packageManifest: createManifest({
      packageJsonPath: "/repo/packages/web/package.json",
      packageDirPath: "/repo/packages/web",
      relativeDirPath: "packages/web",
      isWorkspaceRootPackage: false
    })
  });
  const context = createPackageManagerExecutionContext(
    {
      packageManager: "npm",
      managerRootPath: "/repo"
    },
    "/repo/packages/web"
  );

  const command = buildUpgradeCommand({
    dependency,
    executionContext: context,
    platform: "darwin"
  });

  assert.equal(command.executable, "npm");
  assert.deepEqual(command.args, [
    "install",
    "react@latest",
    "--save-dev",
    "--workspace",
    "packages/web"
  ]);
  assert.equal(command.cwdPath, "/repo");
});

test("buildUpgradeCommand creates a pnpm filter command for nested packages", () => {
  const dependency = createDependency({
    packageManifest: createManifest({
      packageJsonPath: "/repo/apps/admin/package.json",
      packageDirPath: "/repo/apps/admin",
      relativeDirPath: "apps/admin",
      isWorkspaceRootPackage: false
    })
  });
  const context = createPackageManagerExecutionContext(
    {
      packageManager: "pnpm",
      managerRootPath: "/repo"
    },
    "/repo/apps/admin"
  );

  const command = buildUpgradeCommand({
    dependency,
    executionContext: context,
    platform: "darwin"
  });

  assert.deepEqual(command.args, [
    "--filter",
    "./apps/admin",
    "update",
    "react@latest",
    "--prod"
  ]);
  assert.equal(command.cwdPath, "/repo");
});

test("buildUpgradeCommand uses yarn up for modern yarn root projects", () => {
  const dependency = createDependency();
  const context = createPackageManagerExecutionContext(
    {
      packageManager: "yarn",
      managerRootPath: "/repo"
    },
    "/repo"
  );

  const command = buildUpgradeCommand({
    dependency,
    executionContext: context,
    yarnVariant: "modern",
    platform: "darwin"
  });

  assert.deepEqual(command.args, ["up", "react@latest"]);
  assert.equal(command.cwdPath, "/repo");
});

test("buildUpgradeCommand uses yarn workspace add inside a monorepo package", () => {
  const dependency = createDependency({
    section: "devDependencies",
    packageManifest: createManifest({
      packageName: "@repo/web",
      packageJsonPath: "/repo/packages/web/package.json",
      packageDirPath: "/repo/packages/web",
      relativeDirPath: "packages/web",
      isWorkspaceRootPackage: false
    })
  });
  const context = createPackageManagerExecutionContext(
    {
      packageManager: "yarn",
      managerRootPath: "/repo"
    },
    "/repo/packages/web"
  );

  const command = buildUpgradeCommand({
    dependency,
    executionContext: context,
    platform: "darwin"
  });

  assert.deepEqual(command.args, [
    "workspace",
    "@repo/web",
    "add",
    "-D",
    "react@latest"
  ]);
});

test("buildUpgradeCommand runs bun upgrades in the package directory", () => {
  const dependency = createDependency({
    packageManifest: createManifest({
      packageJsonPath: "/repo/packages/api/package.json",
      packageDirPath: "/repo/packages/api",
      relativeDirPath: "packages/api",
      isWorkspaceRootPackage: false
    })
  });
  const context = createPackageManagerExecutionContext(
    {
      packageManager: "bun",
      managerRootPath: "/repo"
    },
    "/repo/packages/api"
  );

  const command = buildUpgradeCommand({
    dependency,
    executionContext: context,
    platform: "darwin"
  });

  assert.deepEqual(command.args, ["update", "react", "--latest"]);
  assert.equal(command.cwdPath, "/repo/packages/api");
});

test("walkUpDirectories includes the starting package and workspace root", () => {
  assert.deepEqual(walkUpDirectories("/repo/packages/web", "/repo"), [
    "/repo/packages/web",
    "/repo/packages",
    "/repo"
  ]);
});
