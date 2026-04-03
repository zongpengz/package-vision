import * as vscode from "vscode";

import {
  DependencyRecord,
  DependencySection,
  DependencyStatus
} from "../models/dependency";
import { PackageJsonService } from "../services/packageJsonService";
import { RegistryService } from "../services/registryService";

// Tree View 里的每个节点都必须能被 getTreeItem() / getChildren() 识别。
// 这里把“分组节点、依赖节点、空状态节点”统一成一个联合类型。
type PackageVisionNode =
  | DependencySectionItem
  | DependencyItem
  | EmptyStateItem;

export class DependencyTreeProvider
  implements vscode.TreeDataProvider<PackageVisionNode>
{
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<PackageVisionNode | undefined | void>();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly packageJsonService: PackageJsonService,
    private readonly registryService: RegistryService
  ) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: PackageVisionNode): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: PackageVisionNode
  ): Promise<PackageVisionNode[]> {
    if (element instanceof DependencySectionItem) {
      // 当 VS Code 展开一个分组节点时，会再次调用 getChildren(section)。
      return element.dependencies.map(
        (dependency) => new DependencyItem(dependency)
      );
    }

    if (element instanceof DependencyItem || element instanceof EmptyStateItem) {
      return [];
    }

    const workspaceFolder = this.packageJsonService.getWorkspaceFolder();
    if (!workspaceFolder) {
      return [
        new EmptyStateItem(
          "Open a workspace folder to inspect dependencies.",
          "Package Vision reads the workspace root package.json."
        )
      ];
    }

    const hasPackageJson = await this.packageJsonService.hasPackageJson();
    if (!hasPackageJson) {
      return [
        new EmptyStateItem(
          "No package.json found in the workspace root.",
          `Workspace: ${workspaceFolder.name}`
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

    return this.buildSectionItems(enrichedDependencies);
  }

  private buildSectionItems(
    dependencies: DependencyRecord[]
  ): DependencySectionItem[] {
    const sections: DependencySection[] = ["dependencies", "devDependencies"];

    return sections
      .map((section) => {
        // 先在内存中按 section 分组，再分别渲染成 Tree Item。
        const sectionDependencies = dependencies.filter(
          (dependency) => dependency.section === section
        );

        if (sectionDependencies.length === 0) {
          return undefined;
        }

        return new DependencySectionItem(section, sectionDependencies);
      })
      .filter(
        (item): item is DependencySectionItem => item !== undefined
      );
  }
}

class DependencySectionItem extends vscode.TreeItem {
  constructor(
    readonly section: DependencySection,
    readonly dependencies: DependencyRecord[]
  ) {
    super(
      formatSectionLabel(section),
      vscode.TreeItemCollapsibleState.Expanded
    );

    const outdatedCount = dependencies.filter(
      (dependency) => dependency.status === "outdated"
    ).length;

    // description 会直接显示在侧边栏右侧，适合放“这个分组里有多少过时依赖”这种摘要信息。
    this.description =
      outdatedCount > 0
        ? `${outdatedCount} outdated / ${dependencies.length}`
        : `${dependencies.length} packages`;
    this.contextValue = "dependencySection";
    this.tooltip = [
      `${formatSectionLabel(section)}`,
      `${dependencies.length} total`,
      `${outdatedCount} outdated`
    ].join(" • ");
  }
}

class DependencyItem extends vscode.TreeItem {
  constructor(readonly dependency: DependencyRecord) {
    super(dependency.name, vscode.TreeItemCollapsibleState.None);

    // TreeItem 的 description 空间比较有限，所以这里只放一行最关键的信息。
    this.description = formatDependencyDescription(dependency);
    this.contextValue = "dependency";
    this.tooltip = new vscode.MarkdownString(
      buildDependencyTooltipLines(dependency).join("\n")
    );
    this.iconPath = getDependencyIcon(dependency.status);
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

function formatDependencyDescription(dependency: DependencyRecord): string {
  if (dependency.latestVersion) {
    return `${dependency.declaredVersion} -> ${dependency.latestVersion}`;
  }

  return `${dependency.declaredVersion} -> unavailable`;
}

function buildDependencyTooltipLines(
  dependency: DependencyRecord
): string[] {
  const lines = [
    `**${dependency.name}**`,
    ``,
    `Section: \`${dependency.section}\``,
    `Declared version: \`${dependency.declaredVersion}\``,
    `Latest version: \`${dependency.latestVersion ?? "Unavailable"}\``,
    `Status: ${formatDependencyStatus(dependency.status)}`
  ];

  if (dependency.errorMessage) {
    lines.push(`Issue: ${dependency.errorMessage}`);
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

function getDependencyIcon(status: DependencyStatus): vscode.ThemeIcon {
  // 这里优先使用 VS Code 内置图标，能天然继承编辑器主题风格。
  switch (status) {
    case "upToDate":
      return new vscode.ThemeIcon("check");
    case "outdated":
      return new vscode.ThemeIcon("warning");
    case "error":
      return new vscode.ThemeIcon("error");
    case "unknown":
    default:
      return new vscode.ThemeIcon("package");
  }
}
