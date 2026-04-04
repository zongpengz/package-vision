import * as path from "node:path";

import type {
  DependencyRecord,
  DependencySection,
  PackageManifestRecord
} from "../models/dependency";

// PackageJsonShape 故意只声明当前项目真正会用到的字段。
// 这样类型不会被 package.json 的所有可能字段“淹没”，
// 对学习者来说也更容易一眼看懂：我们到底关心哪些数据。
export interface PackageJsonShape {
  [key: string]: unknown;
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
  // 相对路径信息主要用于 UI 展示：
  // 在 monorepo 里，用户需要快速知道一个包位于哪个子目录。
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
  // 这一层只负责“把 package.json 的对象结构拍平成依赖列表”，
  // 不负责联网、状态判断或 UI 文案，这样职责会更清晰。
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
  // VS Code 会运行在不同操作系统上；统一成正斜杠后，
  // 路径在 UI、测试断言和文档里都更稳定。
  return filePath.split(path.sep).join("/");
}
