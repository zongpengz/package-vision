import * as vscode from "vscode";

import {
  VersionRangeStyle,
  normalizeConfiguredVersionRangeStyle
} from "./services/versionRangeUtils";

const CONFIGURATION_NAMESPACE = "packageVision";
const VERSION_RANGE_STYLE_SETTING = "upgrade.versionRangeStyle";

export function getUpgradeVersionRangeStyle(
  scope?: vscode.ConfigurationScope
): VersionRangeStyle {
  const configuredValue = vscode.workspace
    .getConfiguration(CONFIGURATION_NAMESPACE, scope)
    .get<string>(VERSION_RANGE_STYLE_SETTING);

  return normalizeConfiguredVersionRangeStyle(configuredValue);
}
