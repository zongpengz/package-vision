import * as vscode from "vscode";

import { DependencyRecord, DependencySection } from "../models/dependency";
import { PackageJsonService } from "../services/packageJsonService";

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

  constructor(private readonly packageJsonService: PackageJsonService) {}

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

    return this.buildSectionItems(dependencies);
  }

  private buildSectionItems(
    dependencies: DependencyRecord[]
  ): DependencySectionItem[] {
    const sections: DependencySection[] = ["dependencies", "devDependencies"];

    return sections
      .map((section) => {
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

    this.description = `${dependencies.length}`;
    this.contextValue = "dependencySection";
    this.tooltip = `${formatSectionLabel(section)} (${dependencies.length})`;
  }
}

class DependencyItem extends vscode.TreeItem {
  constructor(readonly dependency: DependencyRecord) {
    super(dependency.name, vscode.TreeItemCollapsibleState.None);

    this.description = dependency.declaredVersion;
    this.contextValue = "dependency";
    this.tooltip = new vscode.MarkdownString(
      [
        `**${dependency.name}**`,
        ``,
        `Section: \`${dependency.section}\``,
        `Declared version: \`${dependency.declaredVersion}\``
      ].join("\n")
    );
    this.iconPath = new vscode.ThemeIcon("package");
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
