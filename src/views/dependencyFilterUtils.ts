import { DependencyRecord } from "../models/dependency";

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
      return isDependencyUpgrading(dependency);
    }

    return dependency.status === filterMode;
  });
}

export function formatDependencyFilterLabel(
  filterMode: DependencyFilterMode
): string {
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
