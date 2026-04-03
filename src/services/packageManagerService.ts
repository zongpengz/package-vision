import * as path from "node:path";

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
  cwdPath: string;
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

    const { executable, args, cwdPath } =
      packageManager === "yarn"
        ? await this.buildYarnUpgradeCommand(dependency, executionContext)
        : packageManager === "bun"
          ? this.buildBunUpgradeCommand(dependency, executionContext)
          : this.buildUpgradeCommand(packageManager, dependency, executionContext);

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

  private buildUpgradeCommand(
    packageManager: "npm" | "pnpm",
    dependency: DependencyRecord,
    executionContext: PackageManagerExecutionContext
  ): UpgradeCommand {
    if (executionContext.isMonorepoPackage) {
      return packageManager === "pnpm"
        ? this.buildPnpmWorkspaceUpgradeCommand(dependency, executionContext)
        : this.buildNpmWorkspaceUpgradeCommand(dependency, executionContext);
    }

    if (packageManager === "pnpm") {
      const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
      const args =
        dependency.section === "devDependencies"
          ? ["update", `${dependency.name}@latest`, "--dev"]
          : ["update", `${dependency.name}@latest`, "--prod"];

      return {
        executable,
        args,
        cwdPath: executionContext.commandCwdPath
      };
    }

    const executable = process.platform === "win32" ? "npm.cmd" : "npm";
    const args =
      dependency.section === "devDependencies"
        ? ["install", `${dependency.name}@latest`, "--save-dev"]
        : ["install", `${dependency.name}@latest`];

    return {
      executable,
      args,
      cwdPath: executionContext.commandCwdPath
    };
  }

  private buildBunUpgradeCommand(
    dependency: DependencyRecord,
    executionContext: PackageManagerExecutionContext
  ): UpgradeCommand {
    // Bun 官方文档里，升级单个包到最新版本的方式是：
    // `bun update <package> --latest`
    // Bun 会根据 package.json 中已有的依赖分组来更新对应条目。
    const executable = process.platform === "win32" ? "bun.exe" : "bun";

    return {
      executable,
      args: ["update", dependency.name, "--latest"],
      cwdPath: executionContext.packageDirPath
    };
  }

  private async buildYarnUpgradeCommand(
    dependency: DependencyRecord,
    executionContext: PackageManagerExecutionContext
  ): Promise<UpgradeCommand> {
    const executable = process.platform === "win32" ? "yarn.cmd" : "yarn";
    if (executionContext.isMonorepoPackage) {
      const workspaceName = dependency.packageManifest.packageName;
      if (!workspaceName) {
        throw new Error(
          "Yarn workspace upgrades require the target package.json to have a name field."
        );
      }

      const args =
        dependency.section === "devDependencies"
          ? ["workspace", workspaceName, "add", "-D", `${dependency.name}@latest`]
          : ["workspace", workspaceName, "add", `${dependency.name}@latest`];

      return {
        executable,
        args,
        cwdPath: executionContext.commandCwdPath
      };
    }

    const yarnVariant = await this.detectYarnVariant(executionContext);

    // Yarn 2+ 官方推荐用 `yarn up`。
    if (yarnVariant === "modern") {
      return {
        executable,
        args: ["up", `${dependency.name}@latest`],
        cwdPath: executionContext.commandCwdPath
      };
    }

    // Yarn Classic 使用 `yarn upgrade <pkg> --latest` 来忽略旧的 range。
    return {
      executable,
      args: ["upgrade", dependency.name, "--latest"],
      cwdPath: executionContext.commandCwdPath
    };
  }

  private buildNpmWorkspaceUpgradeCommand(
    dependency: DependencyRecord,
    executionContext: PackageManagerExecutionContext
  ): UpgradeCommand {
    const executable = process.platform === "win32" ? "npm.cmd" : "npm";
    const args =
      dependency.section === "devDependencies"
        ? [
            "install",
            `${dependency.name}@latest`,
            "--save-dev",
            "--workspace",
            executionContext.workspaceTarget
          ]
        : [
            "install",
            `${dependency.name}@latest`,
            "--workspace",
            executionContext.workspaceTarget
          ];

    return {
      executable,
      args,
      cwdPath: executionContext.commandCwdPath
    };
  }

  private buildPnpmWorkspaceUpgradeCommand(
    dependency: DependencyRecord,
    executionContext: PackageManagerExecutionContext
  ): UpgradeCommand {
    const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const args =
      dependency.section === "devDependencies"
        ? [
            "--filter",
            executionContext.workspaceFilter,
            "update",
            `${dependency.name}@latest`,
            "--dev"
          ]
        : [
            "--filter",
            executionContext.workspaceFilter,
            "update",
            `${dependency.name}@latest`,
            "--prod"
          ];

    return {
      executable,
      args,
      cwdPath: executionContext.commandCwdPath
    };
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

    const isMonorepoPackage =
      detection.managerRootPath !== packageDirPath &&
      path.relative(detection.managerRootPath, packageDirPath) !== "";
    const relativePackageDir = normalizeRelativePath(
      path.relative(detection.managerRootPath, packageDirPath)
    );

    return {
      packageManager: detection.packageManager,
      managerRootPath: detection.managerRootPath,
      packageDirPath,
      commandCwdPath:
        detection.packageManager === "bun"
          ? packageDirPath
          : detection.managerRootPath,
      isMonorepoPackage,
      workspaceTarget: relativePackageDir,
      workspaceFilter: `./${relativePackageDir}`
    };
  }
}

interface PackageManagerDetectionResult {
  packageManager: PackageManagerKind;
  managerRootPath: string;
}

interface PackageManagerExecutionContext {
  packageManager: PackageManagerKind;
  managerRootPath: string;
  packageDirPath: string;
  commandCwdPath: string;
  isMonorepoPackage: boolean;
  workspaceTarget: string;
  workspaceFilter: string;
}

function* walkUpDirectories(
  startingDirectoryPath: string,
  workspaceFolderPath: string
): Generator<string> {
  let currentDirectoryPath = startingDirectoryPath;
  const normalizedWorkspaceFolderPath = path.resolve(workspaceFolderPath);

  while (currentDirectoryPath.startsWith(normalizedWorkspaceFolderPath)) {
    yield currentDirectoryPath;

    const parentDirectoryPath = path.dirname(currentDirectoryPath);
    if (parentDirectoryPath === currentDirectoryPath) {
      break;
    }

    if (currentDirectoryPath === normalizedWorkspaceFolderPath) {
      break;
    }

    currentDirectoryPath = parentDirectoryPath;
  }
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/");
  return normalized || ".";
}
