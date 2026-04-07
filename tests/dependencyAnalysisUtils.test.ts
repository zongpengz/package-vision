import assert from "node:assert/strict";
import { test } from "node:test";

import type { DependencyRecord, PackageManifestRecord } from "../src/models/dependency";
import { annotateVersionDrift } from "../src/services/dependencyAnalysisUtils";

function createManifest(
  id: string,
  displayName: string,
  relativeDirPath: string
): PackageManifestRecord {
  return {
    id,
    workspaceFolderName: "workspace",
    workspaceFolderUri: "/repo",
    packageJsonPath: `/repo/${relativeDirPath === "." ? "" : `${relativeDirPath}/`}package.json`,
    packageDirPath: relativeDirPath === "." ? "/repo" : `/repo/${relativeDirPath}`,
    displayName,
    relativeDirPath,
    isWorkspaceRootPackage: relativeDirPath === "."
  };
}

function createDependency(
  name: string,
  declaredVersion: string,
  manifest: PackageManifestRecord,
  section: DependencyRecord["section"] = "dependencies"
): DependencyRecord {
  return {
    name,
    section,
    declaredVersion,
    packageManifest: manifest,
    status: "unknown"
  };
}

test("annotateVersionDrift marks dependencies when the same package uses different versions", () => {
  const rootManifest = createManifest("root", "root", ".");
  const webManifest = createManifest("web", "@repo/web", "packages/web");

  const dependencies = annotateVersionDrift([
    createDependency("react", "^18.2.0", rootManifest),
    createDependency("react", "^19.0.0", webManifest)
  ]);

  assert.equal(dependencies.every((dependency) => dependency.hasVersionDrift), true);
  assert.deepEqual(
    dependencies[0].versionDriftEntries?.map((entry) => ({
      packageDisplayName: entry.packageDisplayName,
      relativeDirPath: entry.relativeDirPath,
      declaredVersion: entry.declaredVersion
    })),
    [
      {
        packageDisplayName: "root",
        relativeDirPath: ".",
        declaredVersion: "^18.2.0"
      },
      {
        packageDisplayName: "@repo/web",
        relativeDirPath: "packages/web",
        declaredVersion: "^19.0.0"
      }
    ]
  );
});

test("annotateVersionDrift does not mark dependencies when declared versions stay aligned", () => {
  const rootManifest = createManifest("root", "root", ".");
  const apiManifest = createManifest("api", "@repo/api", "packages/api");

  const dependencies = annotateVersionDrift([
    createDependency("zod", "^3.24.0", rootManifest),
    createDependency("zod", "^3.24.0", apiManifest)
  ]);

  assert.equal(
    dependencies.some((dependency) => dependency.hasVersionDrift),
    false
  );
});
