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

const CONFIGURATION_NAMESPACE = "packageVision";
const MAJOR_UPDATE_STRATEGY_SETTING = "upgrade.majorUpdateStrategy";
const VERSION_RANGE_STYLE_SETTING = "upgrade.versionRangeStyle";

export function getUpgradeVersionRangeStyle(
  scope?: vscode.ConfigurationScope
): VersionRangeStyle {
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
