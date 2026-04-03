export type DependencySection = "dependencies" | "devDependencies";

export type DependencyStatus = "unknown" | "upToDate" | "outdated" | "error";

export interface PackageManifestRecord {
  id: string;
  workspaceFolderName: string;
  workspaceFolderUri: string;
  packageJsonPath: string;
  packageDirPath: string;
  packageManagerSpecifier?: string;
  packageName?: string;
  displayName: string;
  relativeDirPath: string;
  isWorkspaceRootPackage: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DependencyRecord {
  name: string;
  section: DependencySection;
  declaredVersion: string;
  packageManifest: PackageManifestRecord;
  latestVersion?: string;
  status: DependencyStatus;
  errorMessage?: string;
}
