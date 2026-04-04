import * as semver from "semver";

import type { DependencyRecord } from "../models/dependency";
import { getComparableDeclaredVersion } from "./registryUtils";

export type MajorUpdateStrategy = "ask" | "safe" | "latest";
export type UpgradeActionKind = "safe" | "latestMajor" | "latest";

export interface UpgradeChoice {
  upgradeKind: UpgradeActionKind;
  targetVersion: string;
  label: string;
  description: string;
  detail: string;
  isMajorUpdate: boolean;
}

export function normalizeMajorUpdateStrategy(
  value: unknown
): MajorUpdateStrategy {
  switch (value) {
    case "ask":
    case "safe":
    case "latest":
      return value;
    default:
      return "ask";
  }
}

export function getSafeUpgradeTargetVersion(
  dependency: DependencyRecord
): string | undefined {
  const comparableDeclaredVersion = getComparableDeclaredVersion(
    dependency.declaredVersion
  );
  const safeVersion = dependency.latestSafeVersion;

  if (
    !comparableDeclaredVersion ||
    !safeVersion ||
    !semver.valid(safeVersion) ||
    !semver.gt(safeVersion, comparableDeclaredVersion)
  ) {
    return undefined;
  }

  return safeVersion;
}

export function getDefaultDisplayTargetVersion(
  dependency: DependencyRecord
): string | undefined {
  return getSafeUpgradeTargetVersion(dependency) ?? dependency.latestVersion;
}

export function buildMajorAwareUpgradeChoices(
  dependency: DependencyRecord
): UpgradeChoice[] {
  const choices: UpgradeChoice[] = [];
  const comparableDeclaredVersion = getComparableDeclaredVersion(
    dependency.declaredVersion
  );
  const safeTargetVersion = getSafeUpgradeTargetVersion(dependency);

  if (safeTargetVersion && comparableDeclaredVersion) {
    choices.push({
      upgradeKind: "safe",
      targetVersion: safeTargetVersion,
      label: `Upgrade within current major to ${safeTargetVersion}`,
      description: `Recommended: stay on major ${semver.major(comparableDeclaredVersion)}`,
      detail: "Applies the newest patch or minor version within the current major.",
      isMajorUpdate: false
    });
  }

  if (dependency.latestVersion) {
    choices.push({
      upgradeKind: "latestMajor",
      targetVersion: dependency.latestVersion,
      label: `Upgrade to latest major ${dependency.latestVersion}`,
      description: "May include breaking changes",
      detail:
        "Use this when you intentionally want the newest published major version.",
      isMajorUpdate: true
    });
  }

  return choices;
}
