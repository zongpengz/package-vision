// 这一层只放“跨模块共享的数据结构”。
// 当你在 service、view、test 之间来回跳的时候，先看这里，
// 能最快建立整个项目在传递什么数据的整体感。
export type DependencySection = "dependencies" | "devDependencies";

export type DependencyStatus = "unknown" | "upToDate" | "outdated" | "error";

export interface DependencyVersionDriftEntry {
  packageDisplayName: string;
  relativeDirPath: string;
  section: DependencySection;
  declaredVersion: string;
}

export interface PackageManifestRecord {
  // id 用来唯一标识一个 package.json；这里直接复用了 URI 字符串，
  // 对 monorepo 场景已经足够稳定，也不需要再额外生成随机 ID。
  id: string;
  workspaceFolderName: string;
  workspaceFolderUri: string;
  packageJsonPath: string;
  packageDirPath: string;
  packageManagerSpecifier?: string;
  packageName?: string;
  displayName: string;
  relativeDirPath: string;
  isWorkspaceRootPackage: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DependencyRecord {
  // DependencyRecord 是侧边栏里“一个依赖项”的核心数据模型。
  // 它从 package.json 的声明开始，后续会被 registryService
  // 补上 latestVersion、status 等运行时信息。
  name: string;
  section: DependencySection;
  declaredVersion: string;
  packageManifest: PackageManifestRecord;
  latestVersion?: string;
  latestSafeVersion?: string;
  hasMajorUpdate?: boolean;
  hasVersionDrift?: boolean;
  versionDriftEntries?: DependencyVersionDriftEntry[];
  status: DependencyStatus;
  errorMessage?: string;
}
