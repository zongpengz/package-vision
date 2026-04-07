import assert from "node:assert/strict";
import { test } from "node:test";

import type { DependencyRecord, PackageManifestRecord } from "../src/models/dependency";
import {
  filterDependencies,
  filterDependenciesByPackageScope,
  formatDependencyFilterLabel,
  formatDependencyPackageScopeLabel,
  formatDependencySearchLabel
} from "../src/views/dependencyFilterUtils";

function createManifest(
  overrides?: Partial<PackageManifestRecord>
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
  name: string,
  status: DependencyRecord["status"],
  options?: Partial<DependencyRecord>
): DependencyRecord {
  return {
    name,
    section: "dependencies",
    declaredVersion: "^1.0.0",
    packageManifest: createManifest(),
    status
    ,
    ...options
  };
}

test("filterDependencies returns all dependencies when filter mode is all", () => {
  const dependencies = [
    createDependency("react", "outdated"),
    createDependency("zod", "upToDate")
  ];

  assert.equal(
    filterDependencies(dependencies, "all", () => false).length,
    2
  );
});

test("filterDependencies can isolate lookup failures", () => {
  const dependencies = [
    createDependency("react", "outdated"),
    createDependency("axios", "error"),
    createDependency("zod", "upToDate")
  ];

  const filteredDependencies = filterDependencies(
    dependencies,
    "error",
    () => false
  );

  assert.deepEqual(
    filteredDependencies.map((dependency) => dependency.name),
    ["axios"]
  );
});

test("filterDependencies can isolate upgrading dependencies", () => {
  const dependencies = [
    createDependency("react", "outdated"),
    createDependency("axios", "error")
  ];

  const filteredDependencies = filterDependencies(
    dependencies,
    "upgrading",
    (dependency) => dependency.name === "react"
  );

  assert.deepEqual(
    filteredDependencies.map((dependency) => dependency.name),
    ["react"]
  );
});

test("filterDependencies can isolate version drift", () => {
  const dependencies = [
    createDependency("react", "outdated", { hasVersionDrift: true }),
    createDependency("zod", "upToDate")
  ];

  const filteredDependencies = filterDependencies(
    dependencies,
    "versionDrift",
    () => false
  );

  assert.deepEqual(
    filteredDependencies.map((dependency) => dependency.name),
    ["react"]
  );
});

test("filterDependencies can combine status filtering and search", () => {
  const dependencies = [
    createDependency("react", "outdated"),
    createDependency("react-dom", "outdated"),
    createDependency("typescript", "upToDate")
  ];

  const filteredDependencies = filterDependencies(
    dependencies,
    "outdated",
    () => false,
    "dom"
  );

  assert.deepEqual(
    filteredDependencies.map((dependency) => dependency.name),
    ["react-dom"]
  );
});

test("filterDependenciesByPackageScope returns only dependencies from the selected package", () => {
  const rootManifest = createManifest();
  const webManifest = createManifest({
    id: "file:///repo/packages/web/package.json",
    packageJsonPath: "/repo/packages/web/package.json",
    packageDirPath: "/repo/packages/web",
    displayName: "@repo/web",
    relativeDirPath: "packages/web",
    isWorkspaceRootPackage: false
  });
  const dependencies = [
    createDependency("react", "outdated", { packageManifest: webManifest }),
    createDependency("typescript", "upToDate", { packageManifest: rootManifest })
  ];

  const filteredDependencies = filterDependenciesByPackageScope(
    dependencies,
    rootManifest.id
  );

  assert.deepEqual(
    filteredDependencies.map((dependency) => dependency.name),
    ["typescript"]
  );
});

test("filterDependencies applies search case-insensitively", () => {
  const dependencies = [
    createDependency("ReactQuery", "outdated"),
    createDependency("zod", "outdated")
  ];

  const filteredDependencies = filterDependencies(
    dependencies,
    "all",
    () => false,
    "react"
  );

  assert.deepEqual(
    filteredDependencies.map((dependency) => dependency.name),
    ["ReactQuery"]
  );
});

test("formatDependencyFilterLabel returns a user-friendly label", () => {
  assert.equal(formatDependencyFilterLabel("error"), "Lookup Failed");
  assert.equal(formatDependencyFilterLabel("versionDrift"), "Version Drift");
});

test("formatDependencySearchLabel returns a trimmed user-friendly label", () => {
  assert.equal(formatDependencySearchLabel("  react  "), "Search: react");
  assert.equal(formatDependencySearchLabel("   "), undefined);
});

test("formatDependencyPackageScopeLabel returns a user-friendly label", () => {
  assert.equal(
    formatDependencyPackageScopeLabel(createManifest({ displayName: "fixture-root" })),
    "Package: fixture-root (root)"
  );
  assert.equal(
    formatDependencyPackageScopeLabel(
      createManifest({
        displayName: "@fixture/web",
        relativeDirPath: "packages/web",
        isWorkspaceRootPackage: false
      })
    ),
    "Package: @fixture/web"
  );
});
