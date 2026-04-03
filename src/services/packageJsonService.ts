import * as path from "node:path";

import * as vscode from "vscode";

import {
  DependencyRecord,
  DependencySection,
  PackageManifestRecord
} from "../models/dependency";

interface PackageJsonShape {
  packageManager?: string;
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PackageJsonService {
  getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
    return vscode.workspace.workspaceFolders ?? [];
  }

  getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return this.getWorkspaceFolders()[0];
  }

  async hasPackageJson(): Promise<boolean> {
    const manifests = await this.loadPackageManifests();
    return manifests.length > 0;
  }

  async loadDependencies(): Promise<DependencyRecord[]> {
    const manifests = await this.loadPackageManifests();
    return manifests.flatMap((manifest) => [
      ...this.toDependencyRecords(manifest, "dependencies"),
      ...this.toDependencyRecords(manifest, "devDependencies")
    ]);
  }

  async loadPackageManifests(): Promise<PackageManifestRecord[]> {
    const workspaceFolders = this.getWorkspaceFolders();
    const packageJsonUrisByWorkspace = await Promise.all(
      workspaceFolders.map(async (workspaceFolder) => {
        const packageJsonUris = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, "**/package.json"),
          new vscode.RelativePattern(
            workspaceFolder,
            "**/{node_modules,.git,dist,out,coverage,.next,.turbo}/**"
          )
        );

        return packageJsonUris.map((packageJsonUri) => ({
          workspaceFolder,
          packageJsonUri
        }));
      })
    );

    const manifests = await Promise.all(
      packageJsonUrisByWorkspace.flat().map(async ({ workspaceFolder, packageJsonUri }) =>
        this.loadPackageManifest(workspaceFolder, packageJsonUri)
      )
    );

    return manifests.sort((left, right) =>
      left.packageJsonPath.localeCompare(right.packageJsonPath)
    );
  }

  async getPackageManagerSpecifierForDirectory(
    directoryPath: string
  ): Promise<string | undefined> {
    const packageJsonUri = vscode.Uri.file(path.join(directoryPath, "package.json"));
    const packageJson = await this.readPackageJson(packageJsonUri);
    return packageJson?.packageManager;
  }

  private toDependencyRecords(
    manifest: PackageManifestRecord,
    section: DependencySection
  ): DependencyRecord[] {
    const dependencyMap =
      section === "dependencies"
        ? manifest.dependencies
        : manifest.devDependencies;
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
        packageManifest: manifest,
        status: "unknown" as const
      }));
  }

  private async loadPackageManifest(
    workspaceFolder: vscode.WorkspaceFolder,
    packageJsonUri: vscode.Uri
  ): Promise<PackageManifestRecord> {
    const packageJson = await this.readPackageJson(packageJsonUri);
    if (!packageJson) {
      throw new Error(`Unable to read package.json: ${packageJsonUri.fsPath}`);
    }

    const relativePackageJsonPath = normalizePath(
      path.relative(workspaceFolder.uri.fsPath, packageJsonUri.fsPath)
    );
    const relativeDirPath = normalizeRelativeDirPath(
      path.dirname(relativePackageJsonPath)
    );
    const packageDirPath = path.dirname(packageJsonUri.fsPath);
    const displayName =
      packageJson.name ??
      (relativeDirPath === "."
        ? workspaceFolder.name
        : path.basename(packageDirPath));

    return {
      id: packageJsonUri.toString(),
      workspaceFolderName: workspaceFolder.name,
      workspaceFolderUri: workspaceFolder.uri.fsPath,
      packageJsonPath: packageJsonUri.fsPath,
      packageDirPath,
      packageManagerSpecifier: packageJson.packageManager,
      packageName: packageJson.name,
      displayName,
      relativeDirPath,
      isWorkspaceRootPackage: relativeDirPath === ".",
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies
    };
  }

  private async readPackageJson(
    packageJsonUri: vscode.Uri
  ): Promise<PackageJsonShape | undefined> {
    try {
      // 这里故意使用 VS Code 的文件系统 API，而不是 Node 的 fs。
      // 这样代码风格更贴近扩展开发场景，也更容易后续适配 VS Code 的资源模型。
      const raw = await vscode.workspace.fs.readFile(packageJsonUri);
      const text = new TextDecoder("utf-8").decode(raw);
      return JSON.parse(text) as PackageJsonShape;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Unable to read package.json: ${message}`);
    }
  }
}

function normalizeRelativeDirPath(relativeDirPath: string): string {
  return normalizePath(relativeDirPath || ".");
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
