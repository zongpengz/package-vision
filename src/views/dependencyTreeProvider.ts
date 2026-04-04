import * as vscode from "vscode";

import type {
  DependencyRecord,
  PackageManifestRecord,
  DependencySection,
  DependencyStatus
} from "../models/dependency";
import type { PackageJsonService } from "../services/packageJsonService";
import { getComparableDeclaredVersion } from "../services/registryUtils";
import type { RegistryService } from "../services/registryService";
import { getDefaultDisplayTargetVersion } from "../services/upgradeStrategyUtils";
import type {
  DependencyFilterMode} from "./dependencyFilterUtils";
import {
  filterDependencies,
  formatDependencyFilterLabel
} from "./dependencyFilterUtils";

// DependencyTreeProvider 是 VS Code Tree View API 的核心实现。
// 它负责把“依赖数据”翻译成“树节点结构”，是整个 UI 层的中心。
// Tree View 里的每个节点都必须能被 getTreeItem() / getChildren() 识别。
// 这里把“分组节点、依赖节点、空状态节点”统一成一个联合类型。
type PackageVisionNode =
  | PackageManifestItem
  | DependencySectionItem
  | DependencyItem
  | EmptyStateItem;

export class DependencyTreeProvider
  implements vscode.TreeDataProvider<PackageVisionNode>
{
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<PackageVisionNode | undefined | void>();
  private readonly upgradingDependencyKeys = new Set<string>();
  private filterMode: DependencyFilterMode = "all";

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly packageJsonService: PackageJsonService,
    private readonly registryService: RegistryService
  ) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getFilterMode(): DependencyFilterMode {
    return this.filterMode;
  }

  hasActiveFilter(): boolean {
    return this.filterMode !== "all";
  }

  getFilterLabel(): string | undefined {
    return this.hasActiveFilter()
      ? formatDependencyFilterLabel(this.filterMode)
      : undefined;
  }

  setFilterMode(filterMode: DependencyFilterMode): void {
    this.filterMode = filterMode;
    this.refresh();
  }

  startUpgrade(dependency: DependencyRecord): void {
    this.upgradingDependencyKeys.add(createDependencyKey(dependency));
    this.refresh();
  }

  finishUpgrade(dependency: DependencyRecord): void {
    this.upgradingDependencyKeys.delete(createDependencyKey(dependency));
    this.refresh();
  }

  isDependencyUpgrading(dependency: DependencyRecord): boolean {
    return this.upgradingDependencyKeys.has(createDependencyKey(dependency));
  }

  getTreeItem(element: PackageVisionNode): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: PackageVisionNode
  ): Promise<PackageVisionNode[]> {
    // TreeDataProvider 的读取逻辑天然是“递归式”的：
    // 传入不同层级的节点，就返回该节点的子节点。
    if (element instanceof PackageManifestItem) {
      return this.buildSectionItems(
        element.packageManifest,
        element.dependencies
      );
    }

    if (element instanceof DependencySectionItem) {
      // 当 VS Code 展开一个分组节点时，会再次调用 getChildren(section)。
      return element.dependencies.map(
        (dependency) =>
          new DependencyItem(
            dependency,
            this.isDependencyUpgrading(dependency)
          )
      );
    }

    if (element instanceof DependencyItem || element instanceof EmptyStateItem) {
      return [];
    }

    const workspaceFolders = this.packageJsonService.getWorkspaceFolders();
    if (workspaceFolders.length === 0) {
      return [
        new EmptyStateItem(
          "Open a workspace folder to inspect dependencies.",
          "Package Vision scans package.json files across the current workspace."
        )
      ];
    }

    let packageManifests: PackageManifestRecord[];

    try {
      packageManifests = await this.packageJsonService.loadPackageManifests();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      return [
        new EmptyStateItem(
          "Unable to read package.json files.",
          message
        )
      ];
    }

    if (packageManifests.length === 0) {
      return [
        new EmptyStateItem(
          "No package.json files found in the workspace.",
          "Package Vision scans the workspace for package manifests."
        )
      ];
    }

    let dependencies: DependencyRecord[];

    try {
      dependencies = await this.packageJsonService.loadDependencies();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      return [
        new EmptyStateItem(
          "Unable to read package.json.",
          message
        )
      ];
    }

    if (dependencies.length === 0) {
      return [
        new EmptyStateItem(
          "No dependencies found yet.",
          "Add dependencies or devDependencies to package.json."
        )
      ];
    }

    // 先读本地 package.json，再补充 npm registry 的最新版本信息。
    const enrichedDependencies =
      await this.registryService.enrichDependencies(dependencies);
    const visibleDependencies = filterDependencies(
      enrichedDependencies,
      this.filterMode,
      (dependency) => this.isDependencyUpgrading(dependency)
    );

    if (visibleDependencies.length === 0) {
      return [
        new EmptyStateItem(
          "No dependencies match the current filter.",
          `Current filter: ${formatDependencyFilterLabel(this.filterMode)}`
        )
      ];
    }

    if (packageManifests.length === 1) {
      return this.buildSectionItems(packageManifests[0], visibleDependencies);
    }

    return this.buildPackageManifestItems(packageManifests, visibleDependencies);
  }

  private buildPackageManifestItems(
    packageManifests: PackageManifestRecord[],
    dependencies: DependencyRecord[]
  ): PackageManifestItem[] {
    // 多 package.json 时，树的第一层先按 package manifest 分组，
    // 这样用户能快速定位一个依赖属于哪个子包。
    return packageManifests.map((packageManifest) => {
      const manifestDependencies = dependencies.filter(
        (dependency) => dependency.packageManifest.id === packageManifest.id
      );

      return new PackageManifestItem(packageManifest, manifestDependencies);
    }).filter((item) => item.dependencies.length > 0);
  }

  private buildSectionItems(
    packageManifest: PackageManifestRecord,
    dependencies: DependencyRecord[]
  ): DependencySectionItem[] {
    const sections: DependencySection[] = ["dependencies", "devDependencies"];

    return sections
      .map((section) => {
        // 先在内存中按 section 分组，再分别渲染成 Tree Item。
        const sectionDependencies = dependencies.filter(
          (dependency) =>
            dependency.section === section &&
            dependency.packageManifest.id === packageManifest.id
        );

        if (sectionDependencies.length === 0) {
          return undefined;
        }

        const upgradingCount = sectionDependencies.filter((dependency) =>
          this.isDependencyUpgrading(dependency)
        ).length;

        return new DependencySectionItem(
          packageManifest,
          section,
          sectionDependencies,
          upgradingCount
        );
      })
      .filter(
        (item): item is DependencySectionItem => item !== undefined
      );
  }
}

class PackageManifestItem extends vscode.TreeItem {
  constructor(
    readonly packageManifest: PackageManifestRecord,
    readonly dependencies: DependencyRecord[]
  ) {
    super(
      packageManifest.displayName,
      vscode.TreeItemCollapsibleState.Expanded
    );

    const outdatedCount = dependencies.filter(
      (dependency) => dependency.status === "outdated"
    ).length;

    this.description =
      packageManifest.relativeDirPath === "."
        ? `workspace root • ${dependencies.length} packages`
        : `${packageManifest.relativeDirPath} • ${dependencies.length} packages`;
    this.contextValue = "packageManifest";
    this.tooltip = [
      `Package: ${packageManifest.displayName}`,
      `Location: ${packageManifest.relativeDirPath}`,
      `${outdatedCount} outdated`
    ].join(" • ");
  }
}

class DependencySectionItem extends vscode.TreeItem {
  constructor(
    readonly packageManifest: PackageManifestRecord,
    readonly section: DependencySection,
    readonly dependencies: DependencyRecord[],
    upgradingCount: number
  ) {
    super(
      formatSectionLabel(section),
      vscode.TreeItemCollapsibleState.Expanded
    );

    const outdatedCount = dependencies.filter(
      (dependency) => dependency.status === "outdated"
    ).length;

    // Tree View 分组标题本身没有可靠的“加粗”能力，所以这里用图标、颜色和更明确的摘要文案
    // 来拉开 Dependencies / Dev Dependencies 的视觉差异。
    this.iconPath = getSectionIcon(section);
    this.description = formatSectionDescription(
      section,
      dependencies.length,
      outdatedCount,
      upgradingCount
    );
    this.contextValue = "dependencySection";
    this.tooltip = [
      `${formatSectionLabel(section)}`,
      `Type: ${formatSectionKindLabel(section)}`,
      `${dependencies.length} total`,
      `${outdatedCount} outdated`,
      `${upgradingCount} upgrading`
    ].join(" • ");
  }
}

class DependencyItem extends vscode.TreeItem {
  constructor(
    readonly dependency: DependencyRecord,
    private readonly isUpgrading: boolean
  ) {
    super(dependency.name, vscode.TreeItemCollapsibleState.None);

    // TreeItem 的 description 空间比较有限，所以这里只放一行最关键的信息。
    this.description = formatDependencyDescription(dependency, isUpgrading);
    this.contextValue = isUpgrading
      ? "dependencyUpgrading"
      : dependency.status === "outdated"
        ? dependency.hasMajorUpdate
          ? "dependencyOutdatedMajor"
          : "dependencyOutdated"
        : "dependency";
    // contextValue 会驱动 package.json 里 menus.when 的显示条件。
    // 例如“大版本升级”图标只在 dependencyOutdatedMajor 时出现。
    this.tooltip = new vscode.MarkdownString(
      buildDependencyTooltipLines(dependency, isUpgrading).join("\n")
    );
    this.iconPath = getDependencyIcon(dependency.status, isUpgrading);

    // 过时依赖可以直接点击触发升级确认，减少来回切换命令面板的成本。
    if (
      !isUpgrading &&
      dependency.status === "outdated" &&
      dependency.latestVersion
    ) {
      this.command = {
        command: "packageVision.upgradeDependency",
        title: "Upgrade Dependency",
        arguments: [dependency]
      };
    }
  }
}

class EmptyStateItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = description;
    this.contextValue = "emptyState";
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

function formatSectionLabel(section: DependencySection): string {
  return section === "dependencies" ? "Dependencies" : "Dev Dependencies";
}

function formatSectionDescription(
  section: DependencySection,
  total: number,
  outdatedCount: number,
  upgradingCount: number
): string {
  const parts: string[] = [formatSectionKindLabel(section)];

  if (upgradingCount > 0) {
    parts.push(`${upgradingCount} upgrading`);
  }

  if (outdatedCount > 0) {
    parts.push(`${outdatedCount} outdated`);
  }

  if (parts.length === 0) {
    parts.push(`${total} packages`);
  } else {
    parts.push(`${total} total`);
  }

  return parts.join(" • ");
}

function formatSectionKindLabel(section: DependencySection): string {
  return section === "dependencies" ? "runtime" : "tooling";
}

function formatDependencyDescription(
  dependency: DependencyRecord,
  isUpgrading: boolean
): string {
  // description 只放最关键的一行，避免 Tree View 在信息量上过载。
  const displayTargetVersion = getDefaultDisplayTargetVersion(dependency);

  if (isUpgrading) {
    return `Upgrading to ${displayTargetVersion ?? dependency.latestVersion ?? "latest"}...`;
  }

  if (displayTargetVersion) {
    return `${dependency.declaredVersion} -> ${displayTargetVersion}`;
  }

  if (dependency.latestVersion) {
    return `${dependency.declaredVersion} -> ${dependency.latestVersion}`;
  }

  return `${dependency.declaredVersion} -> unavailable`;
}

function buildDependencyTooltipLines(
  dependency: DependencyRecord,
  isUpgrading: boolean
): string[] {
  // 详细信息全部放在 tooltip，保持列表本身简洁，
  // 同时让用户悬浮时还能看到完整上下文。
  const lines = [
    `**${dependency.name}**`,
    ``,
    `Package: \`${dependency.packageManifest.displayName}\``,
    `Location: \`${dependency.packageManifest.relativeDirPath}\``,
    `Section: \`${dependency.section}\``,
    `Declared version: \`${dependency.declaredVersion}\``,
    `Latest version: \`${dependency.latestVersion ?? "Unavailable"}\``,
    `Status: ${formatDependencyStatus(dependency.status)}`
  ];

  if (dependency.errorMessage) {
    lines.push(`Issue: ${dependency.errorMessage}`);
  }

  const safeUpgradeTarget = dependency.latestSafeVersion;
  const comparableDeclaredVersion = getComparableDeclaredVersion(
    dependency.declaredVersion
  );
  if (
    dependency.hasMajorUpdate &&
    safeUpgradeTarget &&
    comparableDeclaredVersion &&
    safeUpgradeTarget !== dependency.latestVersion &&
    safeUpgradeTarget !== comparableDeclaredVersion
  ) {
    lines.push(`Safe target: \`${safeUpgradeTarget}\``);
    lines.push(`Latest major available: \`${dependency.latestVersion}\``);
  } else if (dependency.hasMajorUpdate && dependency.latestVersion) {
    lines.push(`Latest major available: \`${dependency.latestVersion}\``);
  }

  if (isUpgrading) {
    lines.push(`Action: Upgrade in progress. Check the output channel for logs.`);
  }

  if (dependency.status === "outdated") {
    const defaultTargetVersion = getDefaultDisplayTargetVersion(dependency);
    if (defaultTargetVersion) {
      lines.push(`Action: Click this item to upgrade to \`${defaultTargetVersion}\`.`);
    }
  }

  return lines;
}

function formatDependencyStatus(status: DependencyStatus): string {
  switch (status) {
    case "upToDate":
      return "Up to date";
    case "outdated":
      return "Outdated";
    case "error":
      return "Lookup failed";
    case "unknown":
    default:
      return "Unable to compare";
  }
}

function getDependencyIcon(
  status: DependencyStatus,
  isUpgrading: boolean
): vscode.ThemeIcon {
  // 这里优先使用 VS Code 内置图标，能天然继承编辑器主题风格。
  if (isUpgrading) {
    return new vscode.ThemeIcon(
      "sync~spin",
      new vscode.ThemeColor("progressBar.background")
    );
  }

  switch (status) {
    case "upToDate":
      return new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("testing.iconPassed")
      );
    case "outdated":
      return new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("problemsWarningIcon.foreground")
      );
    case "error":
      return new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("problemsErrorIcon.foreground")
      );
    case "unknown":
    default:
      return new vscode.ThemeIcon(
        "package",
        new vscode.ThemeColor("foreground")
      );
  }
}

function getSectionIcon(section: DependencySection): vscode.ThemeIcon {
  if (section === "dependencies") {
    return new vscode.ThemeIcon(
      "package",
      new vscode.ThemeColor("testing.iconPassed")
    );
  }

  return new vscode.ThemeIcon(
    "gear",
    new vscode.ThemeColor("textLink.foreground")
  );
}

function createDependencyKey(dependency: DependencyRecord): string {
  // 同名依赖可能同时出现在不同 package.json 或不同 section，
  // 所以 key 需要把 manifest + section + name 一起纳入。
  return `${dependency.packageManifest.id}:${dependency.section}:${dependency.name}`;
}
