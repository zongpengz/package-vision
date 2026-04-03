import * as vscode from "vscode";

import { DependencyRecord, DependencySection } from "../models/dependency";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PackageJsonService {
  getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
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
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name, declaredVersion]) => ({
        name,
        section,
        declaredVersion
      }));
  }
}
