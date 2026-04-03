export type DependencySection = "dependencies" | "devDependencies";

export interface DependencyRecord {
  name: string;
  section: DependencySection;
  declaredVersion: string;
}
