import * as path from "node:path";

import {
  DependencyRecord,
  DependencySection,
  PackageManifestRecord
} from "../models/dependency";

export interface PackageJsonShape {
  packageManager?: string;
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface BuildPackageManifestRecordInput {
  id: string;
  workspaceFolderName: string;
  workspaceFolderPath: string;
  packageJsonPath: string;
  packageJson: PackageJsonShape;
}

export function buildPackageManifestRecord(
  input: BuildPackageManifestRecordInput
): PackageManifestRecord {
  const relativePackageJsonPath = normalizePath(
    path.relative(input.workspaceFolderPath, input.packageJsonPath)
  );
  const relativeDirPath = normalizeRelativeDirPath(
    path.dirname(relativePackageJsonPath)
  );
  const packageDirPath = path.dirname(input.packageJsonPath);
  const displayName =
    input.packageJson.name ??
    (relativeDirPath === "."
      ? input.workspaceFolderName
      : path.basename(packageDirPath));

  return {
    id: input.id,
    workspaceFolderName: input.workspaceFolderName,
    workspaceFolderUri: input.workspaceFolderPath,
    packageJsonPath: input.packageJsonPath,
    packageDirPath,
    packageManagerSpecifier: input.packageJson.packageManager,
    packageName: input.packageJson.name,
    displayName,
    relativeDirPath,
    isWorkspaceRootPackage: relativeDirPath === ".",
    dependencies: input.packageJson.dependencies,
    devDependencies: input.packageJson.devDependencies
  };
}

export function toDependencyRecords(
  manifest: PackageManifestRecord,
  section: DependencySection
): DependencyRecord[] {
  const dependencyMap =
    section === "dependencies"
      ? manifest.dependencies
      : manifest.devDependencies;
  if (!dependencyMap) {
    return [];
  }

  return Object.entries(dependencyMap)
    // 先按名字排序，保证 Tree View 每次渲染的顺序稳定。
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, declaredVersion]) => ({
      name,
      section,
      declaredVersion,
      packageManifest: manifest,
      status: "unknown" as const
    }));
}

export function normalizeRelativeDirPath(relativeDirPath: string): string {
  return normalizePath(relativeDirPath || ".");
}

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
