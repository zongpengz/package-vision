import * as vscode from "vscode";

import type {
  MajorUpdateStrategy} from "./services/upgradeStrategyUtils";
import {
  normalizeMajorUpdateStrategy
} from "./services/upgradeStrategyUtils";
import type {
  VersionRangeStyle} from "./services/versionRangeUtils";
import {
  normalizeConfiguredVersionRangeStyle
} from "./services/versionRangeUtils";

// 这个文件专门隔离“读取 VS Code 设置项”的逻辑。
// 好处是：
// 1. extension.ts 不需要直接拼配置键名
// 2. 默认值与合法值的兜底逻辑，可以集中在一个地方维护
const CONFIGURATION_NAMESPACE = "packageVision";
const MAJOR_UPDATE_STRATEGY_SETTING = "upgrade.majorUpdateStrategy";
const VERSION_RANGE_STYLE_SETTING = "upgrade.versionRangeStyle";

export function getUpgradeVersionRangeStyle(
  scope?: vscode.ConfigurationScope
): VersionRangeStyle {
  // scope 允许我们按 package.json 所在目录读取设置。
  // 这对多工作区或未来更细粒度的配置都很重要。
  const configuredValue = vscode.workspace
    .getConfiguration(CONFIGURATION_NAMESPACE, scope)
    .get<string>(VERSION_RANGE_STYLE_SETTING);

  return normalizeConfiguredVersionRangeStyle(configuredValue);
}

export function getMajorUpdateStrategy(
  scope?: vscode.ConfigurationScope
): MajorUpdateStrategy {
  const configuredValue = vscode.workspace
    .getConfiguration(CONFIGURATION_NAMESPACE, scope)
    .get<string>(MAJOR_UPDATE_STRATEGY_SETTING);

  return normalizeMajorUpdateStrategy(configuredValue);
}
