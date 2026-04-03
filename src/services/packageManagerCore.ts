import * as path from "node:path";

import { DependencyRecord } from "../models/dependency";

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
  executionContext: PackageManagerExecutionContext;
  yarnVariant?: YarnVariant;
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
  executionContext,
  platform
}: BuildUpgradeCommandInput): UpgradeCommand {
  const executable = getExecutable("npm", platform);

  if (executionContext.isMonorepoPackage) {
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

function buildPnpmUpgradeCommand({
  dependency,
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

function buildYarnUpgradeCommand({
  dependency,
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
        ? ["workspace", workspaceName, "add", "-D", `${dependency.name}@latest`]
        : ["workspace", workspaceName, "add", `${dependency.name}@latest`];

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
        args: ["up", `${dependency.name}@latest`],
        cwdPath: executionContext.commandCwdPath
      }
    : {
        executable,
        args: ["upgrade", dependency.name, "--latest"],
        cwdPath: executionContext.commandCwdPath
      };
}

function buildBunUpgradeCommand({
  dependency,
  executionContext,
  platform
}: BuildUpgradeCommandInput): UpgradeCommand {
  return {
    executable: platform === "win32" ? "bun.exe" : "bun",
    args: ["update", dependency.name, "--latest"],
    cwdPath: executionContext.packageDirPath
  };
}

function getExecutable(
  packageManager: "npm" | "pnpm" | "yarn",
  platform = process.platform
): string {
  return platform === "win32" ? `${packageManager}.cmd` : packageManager;
}
