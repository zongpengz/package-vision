import * as path from "node:path";

import type { DependencyRecord } from "../models/dependency";

// packageManagerCore 只放“纯命令拼装逻辑”和“执行上下文推导逻辑”。
// 它刻意不直接执行命令，这样：
// 1. 逻辑更容易写单元测试
// 2. 不同包管理器的参数差异能集中维护
export type PackageManagerKind = "npm" | "pnpm" | "yarn" | "bun";
export type YarnVariant = "classic" | "modern";

export interface UpgradeCommand {
  executable: string;
  args: string[];
  cwdPath: string;
}

export interface PackageManagerDetectionResult {
  packageManager: PackageManagerKind;
  managerRootPath: string;
}

export interface PackageManagerExecutionContext {
  packageManager: PackageManagerKind;
  managerRootPath: string;
  packageDirPath: string;
  commandCwdPath: string;
  isMonorepoPackage: boolean;
  workspaceTarget: string;
  workspaceFilter: string;
}

interface BuildUpgradeCommandInput {
  dependency: DependencyRecord;
  targetVersion: string;
  executionContext: PackageManagerExecutionContext;
  yarnVariant?: YarnVariant;
  platform?: NodeJS.Platform;
}

interface BuildLockfileSyncCommandInput {
  executionContext: PackageManagerExecutionContext;
  platform?: NodeJS.Platform;
}

export function createPackageManagerExecutionContext(
  detection: PackageManagerDetectionResult,
  packageDirPath: string
): PackageManagerExecutionContext {
  // managerRootPath 表示锁文件或包管理器配置所在位置；
  // packageDirPath 表示当前真正要升级的 package.json 所在目录。
  // 两者不同，就意味着这是一个 monorepo 子包场景。
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

export function buildUpgradeCommand(
  input: BuildUpgradeCommandInput
): UpgradeCommand {
  // 这里统一从 executionContext.packageManager 分发到具体实现，
  // extension/service 层就不需要关心 npm / pnpm / yarn / bun 的参数差异。
  switch (input.executionContext.packageManager) {
    case "npm":
      return buildNpmUpgradeCommand(input);
    case "pnpm":
      return buildPnpmUpgradeCommand(input);
    case "yarn":
      return buildYarnUpgradeCommand(input);
    case "bun":
      return buildBunUpgradeCommand(input);
  }
}

export function buildLockfileSyncCommand(
  input: BuildLockfileSyncCommandInput
): UpgradeCommand {
  // 升级后如果我们又手动改写了 package.json 的版本范围，
  // 就需要再跑一次 install，让 lockfile 和声明版本重新对齐。
  switch (input.executionContext.packageManager) {
    case "npm":
      return buildNpmInstallCommand(input);
    case "pnpm":
      return buildPnpmInstallCommand(input);
    case "yarn":
      return buildYarnInstallCommand(input);
    case "bun":
      return buildBunInstallCommand(input);
  }
}

export function walkUpDirectories(
  startingDirectoryPath: string,
  workspaceFolderPath: string
): string[] {
  // 从当前 package 目录一路向上找锁文件，是 monorepo 识别的关键步骤。
  // 例如 packages/web/package.json 最终可能要受工作区根目录的 pnpm-lock.yaml 控制。
  const directories: string[] = [];
  let currentDirectoryPath = path.resolve(startingDirectoryPath);
  const normalizedWorkspaceFolderPath = path.resolve(workspaceFolderPath);

  while (currentDirectoryPath.startsWith(normalizedWorkspaceFolderPath)) {
    directories.push(currentDirectoryPath);

    const parentDirectoryPath = path.dirname(currentDirectoryPath);
    if (parentDirectoryPath === currentDirectoryPath) {
      break;
    }

    if (currentDirectoryPath === normalizedWorkspaceFolderPath) {
      break;
    }

    currentDirectoryPath = parentDirectoryPath;
  }

  return directories;
}

export function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/");
  return normalized || ".";
}

function buildNpmUpgradeCommand({
  dependency,
  targetVersion,
  executionContext,
  platform
}: BuildUpgradeCommandInput): UpgradeCommand {
  const executable = getExecutable("npm", platform);

  if (executionContext.isMonorepoPackage) {
    // npm workspace 用 --workspace 指定目标包。
    const args =
      dependency.section === "devDependencies"
        ? [
            "install",
            `${dependency.name}@${targetVersion}`,
            "--save-dev",
            "--workspace",
            executionContext.workspaceTarget
          ]
        : [
            "install",
            `${dependency.name}@${targetVersion}`,
            "--workspace",
            executionContext.workspaceTarget
          ];

    return {
      executable,
      args,
      cwdPath: executionContext.commandCwdPath
    };
  }

  const args =
    dependency.section === "devDependencies"
      ? ["install", `${dependency.name}@${targetVersion}`, "--save-dev"]
      : ["install", `${dependency.name}@${targetVersion}`];

  return {
    executable,
    args,
    cwdPath: executionContext.commandCwdPath
  };
}

function buildPnpmUpgradeCommand({
  dependency,
  targetVersion,
  executionContext,
  platform
}: BuildUpgradeCommandInput): UpgradeCommand {
  const executable = getExecutable("pnpm", platform);

  if (executionContext.isMonorepoPackage) {
    // pnpm 在 monorepo 里更常见的写法是 --filter。
    const args =
      dependency.section === "devDependencies"
        ? [
            "--filter",
            executionContext.workspaceFilter,
            "add",
            `${dependency.name}@${targetVersion}`,
            "--save-dev"
          ]
        : [
            "--filter",
            executionContext.workspaceFilter,
            "add",
            `${dependency.name}@${targetVersion}`
          ];

    return {
      executable,
      args,
      cwdPath: executionContext.commandCwdPath
    };
  }

  const args =
    dependency.section === "devDependencies"
      ? ["add", `${dependency.name}@${targetVersion}`, "--save-dev"]
      : ["add", `${dependency.name}@${targetVersion}`];

  return {
    executable,
    args,
    cwdPath: executionContext.commandCwdPath
  };
}

function buildYarnUpgradeCommand({
  dependency,
  targetVersion,
  executionContext,
  yarnVariant,
  platform
}: BuildUpgradeCommandInput): UpgradeCommand {
  const executable = getExecutable("yarn", platform);

  if (executionContext.isMonorepoPackage) {
    // Yarn workspace 子包升级依赖 package.json 里的 name 字段，
    // 所以这里如果没有 name，会明确抛错而不是静默失败。
    const workspaceName = dependency.packageManifest.packageName;
    if (!workspaceName) {
      throw new Error(
        "Yarn workspace upgrades require the target package.json to have a name field."
      );
    }

    const args =
      dependency.section === "devDependencies"
        ? ["workspace", workspaceName, "add", "-D", `${dependency.name}@${targetVersion}`]
        : ["workspace", workspaceName, "add", `${dependency.name}@${targetVersion}`];

    return {
      executable,
      args,
      cwdPath: executionContext.commandCwdPath
    };
  }

  if (!yarnVariant) {
    throw new Error("A Yarn variant is required to build the upgrade command.");
  }

  // Yarn Classic 和 Yarn Modern 的升级命令不同，
  // 所以这里由调用方先判断 variant，再落到具体命令。
  return yarnVariant === "modern"
    ? {
        executable,
        args: ["up", `${dependency.name}@${targetVersion}`],
        cwdPath: executionContext.commandCwdPath
      }
    : {
        executable,
        args: ["upgrade", `${dependency.name}@${targetVersion}`],
        cwdPath: executionContext.commandCwdPath
      };
}

function buildBunUpgradeCommand({
  dependency,
  targetVersion,
  executionContext,
  platform
}: BuildUpgradeCommandInput): UpgradeCommand {
  // Bun 当前直接在目标 package 目录里执行 add 更稳定，
  // 所以 cwd 使用 packageDirPath，而不是 managerRootPath。
  return {
    executable: platform === "win32" ? "bun.exe" : "bun",
    args:
      dependency.section === "devDependencies"
        ? ["add", "-d", `${dependency.name}@${targetVersion}`]
        : ["add", `${dependency.name}@${targetVersion}`],
    cwdPath: executionContext.packageDirPath
  };
}

function buildNpmInstallCommand({
  executionContext,
  platform
}: BuildLockfileSyncCommandInput): UpgradeCommand {
  const executable = getExecutable("npm", platform);
  const args = executionContext.isMonorepoPackage
    ? ["install", "--workspace", executionContext.workspaceTarget]
    : ["install"];

  return {
    executable,
    args,
    cwdPath: executionContext.commandCwdPath
  };
}

function buildPnpmInstallCommand({
  executionContext,
  platform
}: BuildLockfileSyncCommandInput): UpgradeCommand {
  const executable = getExecutable("pnpm", platform);
  const args = executionContext.isMonorepoPackage
    ? ["--filter", executionContext.workspaceFilter, "install"]
    : ["install"];

  return {
    executable,
    args,
    cwdPath: executionContext.commandCwdPath
  };
}

function buildYarnInstallCommand({
  executionContext,
  platform
}: BuildLockfileSyncCommandInput): UpgradeCommand {
  // 对 Yarn 来说，install 本身就会根据 package.json 重新生成 lockfile。
  return {
    executable: getExecutable("yarn", platform),
    args: ["install"],
    cwdPath: executionContext.commandCwdPath
  };
}

function buildBunInstallCommand({
  executionContext,
  platform
}: BuildLockfileSyncCommandInput): UpgradeCommand {
  return {
    executable: platform === "win32" ? "bun.exe" : "bun",
    args: ["install"],
    cwdPath: executionContext.packageDirPath
  };
}

function getExecutable(
  packageManager: "npm" | "pnpm" | "yarn",
  platform = process.platform
): string {
  // Windows 下这些工具一般通过 .cmd 入口启动。
  return platform === "win32" ? `${packageManager}.cmd` : packageManager;
}
