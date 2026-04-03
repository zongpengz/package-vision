import { execFile } from "node:child_process";
import { promisify } from "node:util";

import * as vscode from "vscode";

import { DependencyRecord } from "../models/dependency";
import { PackageJsonService } from "./packageJsonService";

const execFileAsync = promisify(execFile);

type PackageManagerKind = "npm" | "pnpm" | "yarn" | "bun";

interface UpgradeResult {
  commandLine: string;
  packageManager: PackageManagerKind;
}

export class PackageManagerService implements vscode.Disposable {
  private readonly outputChannel =
    vscode.window.createOutputChannel("Package Vision");

  constructor(private readonly packageJsonService: PackageJsonService) {}

  // 第一版先只真正支持 npm。
  // 其他包管理器先做识别和友好报错，避免在错误的工具链上直接改项目。
  async upgradeDependency(
    dependency: DependencyRecord
  ): Promise<UpgradeResult> {
    const workspaceFolder = this.packageJsonService.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("Open a workspace folder before upgrading dependencies.");
    }

    const packageManager = await this.detectPackageManager();
    if (packageManager !== "npm") {
      throw new Error(
        `Automatic upgrades currently support npm only. Detected package manager: ${packageManager}.`
      );
    }

    const executable = process.platform === "win32" ? "npm.cmd" : "npm";
    const args =
      dependency.section === "devDependencies"
        ? ["install", `${dependency.name}@latest`, "--save-dev"]
        : ["install", `${dependency.name}@latest`];

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
