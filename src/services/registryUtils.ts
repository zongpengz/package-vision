import * as semver from "semver";

import type { DependencyStatus } from "../models/dependency";

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
