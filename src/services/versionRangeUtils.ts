import * as semver from "semver";

// 这个文件解决的是：“升级后 package.json 应该写成什么版本范围”。
// 例如是 ^1.2.3、~1.2.3，还是精确版本 1.2.3。
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
  // preserve 模式的含义是：
  // “尽量沿用用户原来写在 package.json 里的风格”。
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
  // 这里只处理当前插件真正支持稳定写回的三种形式。
  // 对更复杂的 range（如 >=、workspace:*）先不强行猜测。
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
