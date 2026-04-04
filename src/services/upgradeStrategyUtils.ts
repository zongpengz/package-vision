import * as semver from "semver";

import type { DependencyRecord } from "../models/dependency";
import { getComparableDeclaredVersion } from "./registryUtils";

// 这里封装的是“大版本升级应该怎么处理”的策略逻辑。
// 这些判断从 extension.ts 抽出来后，入口文件会更聚焦在命令编排。
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
  // safe target 不是“当前 range 能覆盖到哪里”，
  // 而是“当前 major 内实际存在、且比当前声明更新的最高版本”。
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
  // 视图默认优先展示 safe target，
  // 这样用户第一眼看到的是更谨慎、更符合实际升级习惯的目标。
  return getSafeUpgradeTargetVersion(dependency) ?? dependency.latestVersion;
}

export function buildMajorAwareUpgradeChoices(
  dependency: DependencyRecord
): UpgradeChoice[] {
  // ask 策略下的 Quick Pick 选项在这里统一生成，
  // 避免 extension.ts 同时承担 UI 和策略拼装两种职责。
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
