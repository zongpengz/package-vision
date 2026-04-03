export type DependencySection = "dependencies" | "devDependencies";

export type DependencyStatus = "unknown" | "upToDate" | "outdated" | "error";

export interface DependencyRecord {
  name: string;
  section: DependencySection;
  declaredVersion: string;
  latestVersion?: string;
  status: DependencyStatus;
  errorMessage?: string;
}
