import type {
  DependencyRecord,
  DependencyVersionDriftEntry
} from "../models/dependency";

// 这一层放“跨 package 的依赖分析逻辑”。
// 和 package.json 读取、registry 查询、视图渲染分开后，
// 版本分裂这种能力就可以被单元测试和多个 UI 场景复用。
export function annotateVersionDrift(
  dependencies: DependencyRecord[]
): DependencyRecord[] {
  const dependenciesByName = new Map<string, DependencyRecord[]>();

  for (const dependency of dependencies) {
    const groupedDependencies = dependenciesByName.get(dependency.name) ?? [];
    groupedDependencies.push(dependency);
    dependenciesByName.set(dependency.name, groupedDependencies);
  }

  const driftEntriesByDependencyKey = new Map<string, DependencyVersionDriftEntry[]>();

  for (const groupedDependencies of dependenciesByName.values()) {
    const uniqueVersions = new Set(
      groupedDependencies.map((dependency) => dependency.declaredVersion)
    );
    if (uniqueVersions.size <= 1) {
      continue;
    }

    const versionDriftEntries = groupedDependencies
      .map((dependency) => ({
        packageDisplayName: dependency.packageManifest.displayName,
        relativeDirPath: dependency.packageManifest.relativeDirPath,
        section: dependency.section,
        declaredVersion: dependency.declaredVersion
      }))
      .sort((left, right) => {
        const byPath = left.relativeDirPath.localeCompare(right.relativeDirPath);
        if (byPath !== 0) {
          return byPath;
        }

        const bySection = left.section.localeCompare(right.section);
        if (bySection !== 0) {
          return bySection;
        }

        return left.declaredVersion.localeCompare(right.declaredVersion);
      });

    for (const dependency of groupedDependencies) {
      driftEntriesByDependencyKey.set(
        createDependencyAnalysisKey(dependency),
        versionDriftEntries
      );
    }
  }

  return dependencies.map((dependency) => {
    const versionDriftEntries = driftEntriesByDependencyKey.get(
      createDependencyAnalysisKey(dependency)
    );
    if (!versionDriftEntries) {
      return dependency;
    }

    return {
      ...dependency,
      hasVersionDrift: true,
      versionDriftEntries
    };
  });
}

function createDependencyAnalysisKey(dependency: DependencyRecord): string {
  return `${dependency.packageManifest.id}:${dependency.section}:${dependency.name}`;
}
