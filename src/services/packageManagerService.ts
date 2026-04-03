import * as path from "node:path";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import * as vscode from "vscode";

import { DependencyRecord } from "../models/dependency";
import { PackageJsonService } from "./packageJsonService";
import {
  PackageManagerDetectionResult,
  PackageManagerExecutionContext,
  YarnVariant,
  buildUpgradeCommand,
  createPackageManagerExecutionContext,
  walkUpDirectories
} from "./packageManagerCore";

const execFileAsync = promisify(execFile);

interface UpgradeResult {
  commandLine: string;
  packageManager: PackageManagerExecutionContext["packageManager"];
}

export class PackageManagerService implements vscode.Disposable {
  private readonly outputChannel =
    vscode.window.createOutputChannel("Package Vision");

  constructor(private readonly packageJsonService: PackageJsonService) {}

  // 目前自动升级已经支持 npm、pnpm、yarn 和 bun。
  // 其他包管理器先做识别和友好报错，避免在错误的工具链上直接改项目。
  async upgradeDependency(
    dependency: DependencyRecord
  ): Promise<UpgradeResult> {
    const executionContext = await this.resolveExecutionContext(dependency);
    if (!executionContext) {
      throw new Error("Open a workspace folder before upgrading dependencies.");
    }

    const { packageManager } = executionContext;
    if (
      packageManager !== "npm" &&
      packageManager !== "pnpm" &&
      packageManager !== "yarn" &&
      packageManager !== "bun"
    ) {
      throw new Error(
        `Automatic upgrades currently support npm, pnpm, yarn, and bun only. Detected package manager: ${packageManager}.`
      );
    }

    const yarnVariant =
      packageManager === "yarn"
        ? await this.detectYarnVariant(executionContext)
        : undefined;
    const { executable, args, cwdPath } = buildUpgradeCommand({
      dependency,
      executionContext,
      yarnVariant
    });

    const commandLine = [executable, ...args].join(" ");

    this.appendLogLine(
      `Starting upgrade for ${dependency.name} with command: ${commandLine}`
    );

    try {
      const { stdout, stderr } = await execFileAsync(executable, args, {
        cwd: cwdPath,
        maxBuffer: 10 * 1024 * 1024
      });

      if (stdout) {
        this.appendRawOutput(stdout);
      }

      if (stderr) {
        this.appendRawOutput(stderr);
      }

      this.appendLogLine(`Upgrade completed for ${dependency.name}.`);

      return {
        commandLine,
        packageManager
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.appendLogLine(`Upgrade failed for ${dependency.name}: ${message}`);
      throw new Error(message);
    }
  }

  showOutput(): void {
    this.outputChannel.show(true);
  }

  dispose(): void {
    this.outputChannel.dispose();
  }

  private appendLogLine(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  private appendRawOutput(content: string): void {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    for (const line of trimmed.split(/\r?\n/)) {
      this.outputChannel.appendLine(line);
    }
  }

  private async detectPackageManager(
    startingDirectoryPath: string,
    workspaceFolderPath: string
  ): Promise<PackageManagerDetectionResult> {
    for (const directoryPath of walkUpDirectories(
      startingDirectoryPath,
      workspaceFolderPath
    )) {
      if (await this.fileExists(directoryPath, "pnpm-lock.yaml")) {
        return {
          packageManager: "pnpm",
          managerRootPath: directoryPath
        };
      }

      if (await this.fileExists(directoryPath, "yarn.lock")) {
        return {
          packageManager: "yarn",
          managerRootPath: directoryPath
        };
      }

      if (
        (await this.fileExists(directoryPath, "bun.lock")) ||
        (await this.fileExists(directoryPath, "bun.lockb"))
      ) {
        return {
          packageManager: "bun",
          managerRootPath: directoryPath
        };
      }

      if (await this.fileExists(directoryPath, "package-lock.json")) {
        return {
          packageManager: "npm",
          managerRootPath: directoryPath
        };
      }
    }

    return {
      packageManager: "npm",
      managerRootPath: startingDirectoryPath
    };
  }

  private async detectYarnVariant(
    executionContext: PackageManagerExecutionContext
  ): Promise<YarnVariant> {
    const packageManagerSpecifier =
      await this.packageJsonService.getPackageManagerSpecifierForDirectory(
        executionContext.commandCwdPath
      );

    if (packageManagerSpecifier?.startsWith("yarn@")) {
      const version = packageManagerSpecifier.slice("yarn@".length);
      const majorVersion = Number.parseInt(version, 10);

      if (Number.isFinite(majorVersion) && majorVersion >= 2) {
        return "modern";
      }

      return "classic";
    }

    // 这是一个基于项目结构的推断：
    // `.yarnrc.yml` 基本可以视为 Yarn 2+ / Berry 项目。
    if (await this.fileExists(executionContext.commandCwdPath, ".yarnrc.yml")) {
      return "modern";
    }

    return "classic";
  }

  private async fileExists(
    directoryPath: string,
    fileName: string
  ): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(
        vscode.Uri.file(path.join(directoryPath, fileName))
      );
      return true;
    } catch {
      return false;
    }
  }

  private async resolveExecutionContext(
    dependency: DependencyRecord
  ): Promise<PackageManagerExecutionContext | undefined> {
    const workspaceFolderPath = dependency.packageManifest.workspaceFolderUri;
    const packageDirPath = dependency.packageManifest.packageDirPath;

    const detection = await this.detectPackageManager(
      packageDirPath,
      workspaceFolderPath
    );

    return createPackageManagerExecutionContext(detection, packageDirPath);
  }
}
