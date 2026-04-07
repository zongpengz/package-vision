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
  isDependencyUpgrading: (dependency: DependencyRecord) => boolean,
  searchQuery = ""
): DependencyRecord[] {
  const trimmedSearchQuery = normalizeDependencySearchQuery(searchQuery);

  return dependencies.filter((dependency) => {
    const matchesFilter =
      filterMode === "all"
        ? true
        : filterMode === "upgrading"
          ? isDependencyUpgrading(dependency)
          : dependency.status === filterMode;

    if (!matchesFilter) {
      return false;
    }

    if (!trimmedSearchQuery) {
      return true;
    }

    return dependency.name.toLocaleLowerCase().includes(trimmedSearchQuery);
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

export function normalizeDependencySearchQuery(searchQuery: string): string {
  return searchQuery.trim().toLocaleLowerCase();
}

export function formatDependencySearchLabel(
  searchQuery: string
): string | undefined {
  const trimmedSearchQuery = searchQuery.trim();
  return trimmedSearchQuery ? `Search: ${trimmedSearchQuery}` : undefined;
}
