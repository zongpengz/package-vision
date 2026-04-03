import * as semver from "semver";

import { DependencyStatus } from "../models/dependency";

export function determineDependencyStatus(
  declaredVersion: string,
  latestVersion: string
): DependencyStatus {
  const normalizedRange = normalizeSemverRange(declaredVersion);
  if (!normalizedRange) {
    // 像 git URL、workspace:* 这类版本声明不一定能被 semver 正常理解，
    // 这时我们保留 latestVersion，但把状态标成 unknown。
    return "unknown";
  }

  return semver.satisfies(latestVersion, normalizedRange)
    ? "upToDate"
    : "outdated";
}

export function normalizeSemverRange(range: string): string | undefined {
  const validRange = semver.validRange(range);
  return validRange ?? undefined;
}
