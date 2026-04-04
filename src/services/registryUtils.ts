import * as semver from "semver";

import type { DependencyStatus } from "../models/dependency";

// registryUtils 只放“纯 semver 判断”。
// 这样这些规则就能被单元测试直接覆盖，而不用真的发网络请求。
export function determineDependencyStatus(
  declaredVersion: string,
  latestVersion: string
): DependencyStatus {
  const comparableDeclaredVersion = getComparableDeclaredVersion(declaredVersion);
  if (!comparableDeclaredVersion || !semver.valid(latestVersion)) {
    // 像 git URL、workspace:* 这类版本声明不一定能被 semver 正常理解，
    // 这时我们保留 latestVersion，但把状态标成 unknown。
    return "unknown";
  }

  // 这里不再按“latest 是否满足当前 range”判断，因为 ^1.7.10 虽然覆盖 1.7.11，
  // 但从用户视角看，package.json 里声明的仍然是 1.7.10 这一基线版本，
  // 依然应该允许升级到更新的声明版本。
  return semver.lt(comparableDeclaredVersion, latestVersion)
    ? "outdated"
    : "upToDate";
}

export function normalizeSemverRange(range: string): string | undefined {
  const validRange = semver.validRange(range);
  return validRange ?? undefined;
}

export function getComparableDeclaredVersion(
  declaredVersion: string
): string | undefined {
  // 这里取的是 minVersion，而不是直接取 range 里的原始字符串。
  // 例如 ^1.7.10 的“可比较基线”应当是 1.7.10，
  // 这样我们才能判断有没有更新的声明目标值得写回 package.json。
  const normalizedRange = normalizeSemverRange(declaredVersion);
  if (!normalizedRange) {
    return undefined;
  }

  return semver.minVersion(normalizedRange)?.version;
}

export function findLatestVersionInCurrentMajor(
  declaredVersion: string,
  availableVersions: string[]
): string | undefined {
  // 这一步是“大版本谨慎升级”体验的基础：
  // 先找出当前 major 内能升到的最高稳定版本。
  const comparableDeclaredVersion = getComparableDeclaredVersion(declaredVersion);
  if (!comparableDeclaredVersion) {
    return undefined;
  }

  const currentMajor = semver.major(comparableDeclaredVersion);
  const sameMajorVersions = availableVersions
    .filter((version): version is string => semver.valid(version) !== null)
    .filter((version) => semver.major(version) === currentMajor)
    .sort(semver.rcompare);

  return sameMajorVersions[0];
}

export function hasMajorUpdate(
  declaredVersion: string,
  latestVersion: string
): boolean {
  const comparableDeclaredVersion = getComparableDeclaredVersion(declaredVersion);
  if (!comparableDeclaredVersion || !semver.valid(latestVersion)) {
    return false;
  }

  return semver.major(latestVersion) > semver.major(comparableDeclaredVersion);
}
