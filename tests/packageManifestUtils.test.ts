import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPackageManifestRecord,
  toDependencyRecords
} from "../src/services/packageManifestUtils";

test("buildPackageManifestRecord marks workspace root manifests correctly", () => {
  const manifest = buildPackageManifestRecord({
    id: "file:///repo/package.json",
    workspaceFolderName: "package-vision",
    workspaceFolderPath: "/repo",
    packageJsonPath: "/repo/package.json",
    packageJson: {
      dependencies: {
        react: "^19.0.0"
      }
    }
  });

  assert.equal(manifest.displayName, "package-vision");
  assert.equal(manifest.relativeDirPath, ".");
  assert.equal(manifest.isWorkspaceRootPackage, true);
});

test("buildPackageManifestRecord prefers package name and keeps nested relative path", () => {
  const manifest = buildPackageManifestRecord({
    id: "file:///repo/packages/web/package.json",
    workspaceFolderName: "workspace",
    workspaceFolderPath: "/repo",
    packageJsonPath: "/repo/packages/web/package.json",
    packageJson: {
      name: "@repo/web",
      devDependencies: {
        vite: "^7.0.0"
      }
    }
  });

  assert.equal(manifest.displayName, "@repo/web");
  assert.equal(manifest.relativeDirPath, "packages/web");
  assert.equal(manifest.isWorkspaceRootPackage, false);
});

test("toDependencyRecords sorts dependency names for stable tree rendering", () => {
  const manifest = buildPackageManifestRecord({
    id: "file:///repo/package.json",
    workspaceFolderName: "workspace",
    workspaceFolderPath: "/repo",
    packageJsonPath: "/repo/package.json",
    packageJson: {
      dependencies: {
        zod: "^3.0.0",
        react: "^19.0.0",
        axios: "^1.0.0"
      }
    }
  });

  const dependencies = toDependencyRecords(manifest, "dependencies");

  assert.deepEqual(
    dependencies.map((dependency) => dependency.name),
    ["axios", "react", "zod"]
  );
});
