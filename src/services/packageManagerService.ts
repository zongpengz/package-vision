import { execFile } from "node:child_process";
import { promisify } from "node:util";

import * as vscode from "vscode";

import { DependencyRecord } from "../models/dependency";
import { PackageJsonService } from "./packageJsonService";

const execFileAsync = promisify(execFile);

type PackageManagerKind = "npm" | "pnpm" | "yarn" | "bun";
type YarnVariant = "classic" | "modern";

interface UpgradeResult {
  commandLine: string;
  packageManager: PackageManagerKind;
}

interface UpgradeCommand {
  executable: string;
  args: string[];
}

export class PackageManagerService implements vscode.Disposable {
  private readonly outputChannel =
    vscode.window.createOutputChannel("Package Vision");

  constructor(private readonly packageJsonService: PackageJsonService) {}

  // 目前自动升级已经支持 npm、pnpm 和 yarn。
  // 其他包管理器先做识别和友好报错，避免在错误的工具链上直接改项目。
  async upgradeDependency(
    dependency: DependencyRecord
  ): Promise<UpgradeResult> {
    const workspaceFolder = this.packageJsonService.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("Open a workspace folder before upgrading dependencies.");
    }

    const packageManager = await this.detectPackageManager();
    if (
      packageManager !== "npm" &&
      packageManager !== "pnpm" &&
      packageManager !== "yarn"
    ) {
      throw new Error(
        `Automatic upgrades currently support npm, pnpm, and yarn only. Detected package manager: ${packageManager}.`
      );
    }

    const { executable, args } =
      packageManager === "yarn"
        ? await this.buildYarnUpgradeCommand(dependency)
        : this.buildUpgradeCommand(packageManager, dependency);

    const commandLine = [executable, ...args].join(" ");

    this.appendLogLine(
      `Starting upgrade for ${dependency.name} with command: ${commandLine}`
    );

    try {
      const { stdout, stderr } = await execFileAsync(executable, args, {
        cwd: workspaceFolder.uri.fsPath,
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

  private buildUpgradeCommand(
    packageManager: "npm" | "pnpm",
    dependency: DependencyRecord
  ): UpgradeCommand {
    if (packageManager === "pnpm") {
      const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
      const args =
        dependency.section === "devDependencies"
          ? ["update", `${dependency.name}@latest`, "--dev"]
          : ["update", `${dependency.name}@latest`, "--prod"];

      return {
        executable,
        args
      };
    }

    const executable = process.platform === "win32" ? "npm.cmd" : "npm";
    const args =
      dependency.section === "devDependencies"
        ? ["install", `${dependency.name}@latest`, "--save-dev"]
        : ["install", `${dependency.name}@latest`];

    return {
      executable,
      args
    };
  }

  private async buildYarnUpgradeCommand(
    dependency: DependencyRecord
  ): Promise<UpgradeCommand> {
    const executable = process.platform === "win32" ? "yarn.cmd" : "yarn";
    const yarnVariant = await this.detectYarnVariant();

    // Yarn 2+ 官方推荐用 `yarn up`。
    if (yarnVariant === "modern") {
      return {
        executable,
        args: ["up", `${dependency.name}@latest`]
      };
    }

    // Yarn Classic 使用 `yarn upgrade <pkg> --latest` 来忽略旧的 range。
    return {
      executable,
      args: ["upgrade", dependency.name, "--latest"]
    };
  }

  private async detectPackageManager(): Promise<PackageManagerKind> {
    if (await this.fileExists("pnpm-lock.yaml")) {
      return "pnpm";
    }

    if (await this.fileExists("yarn.lock")) {
      return "yarn";
    }

    if (await this.fileExists("bun.lockb") || await this.fileExists("bun.lock")) {
      return "bun";
    }

    return "npm";
  }

  private async detectYarnVariant(): Promise<YarnVariant> {
    const packageManagerSpecifier =
      await this.packageJsonService.getPackageManagerSpecifier();

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
    if (await this.fileExists(".yarnrc.yml")) {
      return "modern";
    }

    return "classic";
  }

  private async fileExists(fileName: string): Promise<boolean> {
    const workspaceFolder = this.packageJsonService.getWorkspaceFolder();
    if (!workspaceFolder) {
      return false;
    }

    try {
      await vscode.workspace.fs.stat(
        vscode.Uri.joinPath(workspaceFolder.uri, fileName)
      );
      return true;
    } catch {
      return false;
    }
  }
}
