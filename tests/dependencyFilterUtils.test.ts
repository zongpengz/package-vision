import assert from "node:assert/strict";
import { test } from "node:test";

import { DependencyRecord, PackageManifestRecord } from "../src/models/dependency";
import {
  filterDependencies,
  formatDependencyFilterLabel
} from "../src/views/dependencyFilterUtils";

function createManifest(): PackageManifestRecord {
  return {
    id: "file:///repo/package.json",
    workspaceFolderName: "workspace",
    workspaceFolderUri: "/repo",
    packageJsonPath: "/repo/package.json",
    packageDirPath: "/repo",
    displayName: "workspace",
    relativeDirPath: ".",
    isWorkspaceRootPackage: true
  };
}

function createDependency(
  name: string,
  status: DependencyRecord["status"]
): DependencyRecord {
  return {
    name,
    section: "dependencies",
    declaredVersion: "^1.0.0",
    packageManifest: createManifest(),
    status
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

test("formatDependencyFilterLabel returns a user-friendly label", () => {
  assert.equal(formatDependencyFilterLabel("error"), "Lookup Failed");
});
