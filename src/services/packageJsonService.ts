import * as vscode from "vscode";

import { DependencyRecord, DependencySection } from "../models/dependency";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PackageJsonService {
  getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    // 当前先取第一个工作区根目录。
    // 多工作区/monorepo 后面可以在这里继续扩展。
    return vscode.workspace.workspaceFolders?.[0];
  }

  getPackageJsonUri(): vscode.Uri | undefined {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      return undefined;
    }

    return vscode.Uri.joinPath(workspaceFolder.uri, "package.json");
  }

  async hasPackageJson(): Promise<boolean> {
    const packageJsonUri = this.getPackageJsonUri();
    if (!packageJsonUri) {
      return false;
    }

    try {
      await vscode.workspace.fs.stat(packageJsonUri);
      return true;
    } catch {
      return false;
    }
  }

  async loadDependencies(): Promise<DependencyRecord[]> {
    const packageJsonUri = this.getPackageJsonUri();
    if (!packageJsonUri) {
      return [];
    }

    try {
      // 这里故意使用 VS Code 的文件系统 API，而不是 Node 的 fs。
      // 这样代码风格更贴近扩展开发场景，也更容易后续适配 VS Code 的资源模型。
      const raw = await vscode.workspace.fs.readFile(packageJsonUri);
      const text = new TextDecoder("utf-8").decode(raw);
      const packageJson = JSON.parse(text) as PackageJsonShape;

      return [
        ...this.toDependencyRecords(packageJson.dependencies, "dependencies"),
        ...this.toDependencyRecords(packageJson.devDependencies, "devDependencies")
      ];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Unable to read package.json: ${message}`);
    }
  }

  private toDependencyRecords(
    dependencyMap: Record<string, string> | undefined,
    section: DependencySection
  ): DependencyRecord[] {
    if (!dependencyMap) {
      return [];
    }

    return Object.entries(dependencyMap)
      // 先按名字排序，保证 Tree View 每次渲染的顺序稳定。
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name, declaredVersion]) => ({
        name,
        section,
        declaredVersion,
        status: "unknown" as const
      }));
  }
}
