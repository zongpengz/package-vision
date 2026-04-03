import * as path from "node:path";

import * as vscode from "vscode";

import { DependencyRecord, PackageManifestRecord } from "../models/dependency";
import {
  PackageJsonShape,
  buildPackageManifestRecord,
  toDependencyRecords
} from "./packageManifestUtils";

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
      ...toDependencyRecords(manifest, "dependencies"),
      ...toDependencyRecords(manifest, "devDependencies")
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

  async readDependencyDeclaration(
    packageManifest: PackageManifestRecord,
    dependencyName: string,
    section: DependencyRecord["section"]
  ): Promise<string | undefined> {
    const packageJson = await this.readPackageJson(
      vscode.Uri.file(packageManifest.packageJsonPath)
    );

    return packageJson?.[section]?.[dependencyName];
  }

  async updateDependencyDeclaration(
    packageManifest: PackageManifestRecord,
    dependencyName: string,
    section: DependencyRecord["section"],
    versionRange: string
  ): Promise<void> {
    const packageJsonUri = vscode.Uri.file(packageManifest.packageJsonPath);
    const packageJson = await this.readPackageJson(packageJsonUri);
    if (!packageJson) {
      throw new Error(`Unable to read package.json: ${packageManifest.packageJsonPath}`);
    }

    const sectionEntries = {
      ...(packageJson[section] ?? {})
    };
    sectionEntries[dependencyName] = versionRange;
    packageJson[section] = sectionEntries;

    await this.writePackageJson(packageJsonUri, packageJson);
  }

  private async loadPackageManifest(
    workspaceFolder: vscode.WorkspaceFolder,
    packageJsonUri: vscode.Uri
  ): Promise<PackageManifestRecord> {
    const packageJson = await this.readPackageJson(packageJsonUri);
    if (!packageJson) {
      throw new Error(`Unable to read package.json: ${packageJsonUri.fsPath}`);
    }

    return buildPackageManifestRecord({
      id: packageJsonUri.toString(),
      workspaceFolderName: workspaceFolder.name,
      workspaceFolderPath: workspaceFolder.uri.fsPath,
      packageJsonPath: packageJsonUri.fsPath,
      packageJson
    });
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

  private async writePackageJson(
    packageJsonUri: vscode.Uri,
    packageJson: PackageJsonShape
  ): Promise<void> {
    // 这里先用统一的 2 空格缩进写回文件，优先保证实现简单、稳定、便于学习。
    const text = `${JSON.stringify(packageJson, null, 2)}\n`;
    await vscode.workspace.fs.writeFile(
      packageJsonUri,
      new TextEncoder().encode(text)
    );
  }
}
