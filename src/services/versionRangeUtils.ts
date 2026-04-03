import * as semver from "semver";

export type VersionRangeStyle = "preserve" | "caret" | "tilde" | "exact";
export type SavedVersionRangeStyle = Exclude<VersionRangeStyle, "preserve">;

interface ResolvedVersionRange {
  versionRange: string;
  savedStyle: SavedVersionRangeStyle;
  usedFallbackStyle: boolean;
}

export function normalizeConfiguredVersionRangeStyle(
  value: unknown
): VersionRangeStyle {
  switch (value) {
    case "preserve":
    case "caret":
    case "tilde":
    case "exact":
      return value;
    default:
      return "preserve";
  }
}

export function resolveVersionRangeStyle(
  configuredStyle: VersionRangeStyle,
  declaredVersion: string,
  latestVersion: string
): ResolvedVersionRange {
  const savedStyle =
    configuredStyle === "preserve"
      ? detectSavedVersionRangeStyle(declaredVersion) ?? "caret"
      : configuredStyle;

  return {
    versionRange: formatVersionRange(latestVersion, savedStyle),
    savedStyle,
    usedFallbackStyle:
      configuredStyle === "preserve" &&
      detectSavedVersionRangeStyle(declaredVersion) === undefined
  };
}

export function detectSavedVersionRangeStyle(
  declaredVersion: string
): SavedVersionRangeStyle | undefined {
  const trimmedVersion = declaredVersion.trim();
  if (trimmedVersion.startsWith("^")) {
    return semver.valid(trimmedVersion.slice(1)) ? "caret" : undefined;
  }

  if (trimmedVersion.startsWith("~")) {
    return semver.valid(trimmedVersion.slice(1)) ? "tilde" : undefined;
  }

  return semver.valid(trimmedVersion) ? "exact" : undefined;
}

export function formatVersionRange(
  version: string,
  style: SavedVersionRangeStyle
): string {
  switch (style) {
    case "caret":
      return `^${version}`;
    case "tilde":
      return `~${version}`;
    case "exact":
      return version;
  }
}
