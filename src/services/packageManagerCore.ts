import * as path from "node:path";

import { DependencyRecord } from "../models/dependency";
import { SavedVersionRangeStyle, VersionRangeStyle } from "./versionRangeUtils";

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
  return platform === "win32" ? `${packageManager}.cmd` : packageManager;
}
