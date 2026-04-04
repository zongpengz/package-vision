import assert from "node:assert/strict";
import { test } from "node:test";

import type { DependencyRecord, PackageManifestRecord } from "../src/models/dependency";
import {
  buildMajorAwareUpgradeChoices,
  getDefaultDisplayTargetVersion,
  getSafeUpgradeTargetVersion,
  normalizeMajorUpdateStrategy
} from "../src/services/upgradeStrategyUtils";

function createManifest(
  overrides: Partial<PackageManifestRecord> = {}
): PackageManifestRecord {
  return {
    id: "workspace",
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
    declaredVersion: "^2.0.0",
    packageManifest: createManifest(),
    latestVersion: "30.0.0",
    latestSafeVersion: "2.5.4",
    hasMajorUpdate: true,
    status: "outdated",
    ...overrides
  };
}

test("normalizeMajorUpdateStrategy falls back to ask", () => {
  assert.equal(normalizeMajorUpdateStrategy("safe"), "safe");
  assert.equal(normalizeMajorUpdateStrategy("invalid"), "ask");
});

test("getSafeUpgradeTargetVersion returns the newest version within the current major", () => {
  assert.equal(getSafeUpgradeTargetVersion(createDependency()), "2.5.4");
});

test("getDefaultDisplayTargetVersion prefers the safe target when a major update exists", () => {
  assert.equal(getDefaultDisplayTargetVersion(createDependency()), "2.5.4");
});

test("buildMajorAwareUpgradeChoices returns both safe and major upgrade options", () => {
  const choices = buildMajorAwareUpgradeChoices(createDependency());

  assert.deepEqual(
    choices.map((choice) => choice.targetVersion),
    ["2.5.4", "30.0.0"]
  );
  assert.equal(choices[0].isMajorUpdate, false);
  assert.equal(choices[1].isMajorUpdate, true);
});
