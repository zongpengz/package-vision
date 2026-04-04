import type { DependencyRecord } from "../models/dependency";

// 筛选逻辑单独抽到这里，是为了让 Tree View 层只专注于“怎么渲染树”，
// 而把“哪些依赖应该显示”变成可单测的纯函数。
export type DependencyFilterMode =
  | "all"
  | "outdated"
  | "upToDate"
  | "error"
  | "unknown"
  | "upgrading";

export function filterDependencies(
  dependencies: DependencyRecord[],
  filterMode: DependencyFilterMode,
  isDependencyUpgrading: (dependency: DependencyRecord) => boolean
): DependencyRecord[] {
  if (filterMode === "all") {
    return dependencies;
  }

  return dependencies.filter((dependency) => {
    if (filterMode === "upgrading") {
      // upgrading 不是 DependencyRecord 自带状态，而是运行时 UI 状态，
      // 所以需要额外通过回调判断。
      return isDependencyUpgrading(dependency);
    }

    return dependency.status === filterMode;
  });
}

export function formatDependencyFilterLabel(
  filterMode: DependencyFilterMode
): string {
  // 这里统一管理用户可见文案，避免多个位置各自写一套标签。
  switch (filterMode) {
    case "outdated":
      return "Outdated";
    case "upToDate":
      return "Up To Date";
    case "error":
      return "Lookup Failed";
    case "unknown":
      return "Unable To Compare";
    case "upgrading":
      return "Upgrading";
    case "all":
    default:
      return "All";
  }
}
