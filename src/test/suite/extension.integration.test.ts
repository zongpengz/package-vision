import * as assert from "node:assert/strict";

import * as vscode from "vscode";

import { DependencyRecord } from "../../models/dependency";
import { PackageJsonService } from "../../services/packageJsonService";
import { RegistryService } from "../../services/registryService";
import { DependencyTreeProvider } from "../../views/dependencyTreeProvider";

suite("Package Vision Extension Host", () => {
  suiteSetup(async function () {
    this.timeout(60000);

    const extension = vscode.extensions.getExtension("zongpengz.package-vision");
    assert.ok(extension, "Expected the Package Vision extension to be installed.");

    await extension.activate();
  });

  test("registers the expected commands", async () => {
    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes("packageVision.refresh"));
    assert.ok(commands.includes("packageVision.setFilter"));
    assert.ok(commands.includes("packageVision.clearFilter"));
    assert.ok(commands.includes("packageVision.upgradeDependency"));
    assert.ok(commands.includes("packageVision.upgradeDependencyToLatestMajor"));
    assert.ok(commands.includes("packageVision.showOutput"));
  });

  test("discovers package manifests in the integration fixture workspace", async () => {
    const packageJsonService = new PackageJsonService();
    const packageManifests = await packageJsonService.loadPackageManifests();

    assert.equal(packageManifests.length, 3);
    assert.deepEqual(
      packageManifests.map((packageManifest) => packageManifest.relativeDirPath),
      [".", "packages/api", "packages/web"]
    );
    assert.deepEqual(
      packageManifests.map((packageManifest) => packageManifest.displayName),
      ["fixture-root", "@fixture/api", "@fixture/web"]
    );
  });

  test("renders package groups for a multi-package workspace", async () => {
    const treeProvider = new DependencyTreeProvider(
      new PackageJsonService(),
      createStubRegistryService()
    );

    const topLevelNodes = await treeProvider.getChildren();
    const topLevelLabels = topLevelNodes.map((node) =>
      getTreeItemLabel(treeProvider.getTreeItem(node))
    );

    assert.deepEqual(topLevelLabels, ["fixture-root", "@fixture/api", "@fixture/web"]);
  });

  test("applies the outdated filter before rendering the tree", async () => {
    const treeProvider = new DependencyTreeProvider(
      new PackageJsonService(),
      createStubRegistryService()
    );
    treeProvider.setFilterMode("outdated");

    const topLevelNodes = await treeProvider.getChildren();
    const topLevelLabels = topLevelNodes.map((node) =>
      getTreeItemLabel(treeProvider.getTreeItem(node))
    );

    assert.deepEqual(topLevelLabels, ["@fixture/api", "@fixture/web"]);

    const webPackageNode = topLevelNodes.find(
      (node) => getTreeItemLabel(treeProvider.getTreeItem(node)) === "@fixture/web"
    );
    assert.ok(webPackageNode);

    const sectionNodes = await treeProvider.getChildren(webPackageNode);
    assert.deepEqual(
      sectionNodes.map((node) => getTreeItemLabel(treeProvider.getTreeItem(node))),
      ["Dependencies"]
    );

    const dependencyNodes = await treeProvider.getChildren(sectionNodes[0]);
    assert.deepEqual(
      dependencyNodes.map((node) => getTreeItemLabel(treeProvider.getTreeItem(node))),
      ["react"]
    );
  });

  test("shows an empty state when no dependency matches the active filter", async () => {
    const treeProvider = new DependencyTreeProvider(
      new PackageJsonService(),
      createStubRegistryService()
    );
    treeProvider.setFilterMode("error");

    const topLevelNodes = await treeProvider.getChildren();
    assert.equal(topLevelNodes.length, 1);

    const emptyStateItem = treeProvider.getTreeItem(topLevelNodes[0]);
    assert.equal(
      getTreeItemLabel(emptyStateItem),
      "No dependencies match the current filter."
    );
    assert.equal(emptyStateItem.description, "Current filter: Lookup Failed");
  });

  test("refresh and output commands execute without throwing", async () => {
    await vscode.commands.executeCommand("packageVision.refresh");
    await vscode.commands.executeCommand("packageVision.showOutput");
  });
});

function createStubRegistryService(): RegistryService {
  return {
    async enrichDependencies(
      dependencies: DependencyRecord[]
    ): Promise<DependencyRecord[]> {
      return dependencies.map((dependency) => {
        switch (dependency.name) {
          case "react":
            return {
              ...dependency,
              latestVersion: "19.0.0",
              latestSafeVersion: "18.3.1",
              hasMajorUpdate: true,
              status: "outdated" as const
            };
          case "zod":
            return {
              ...dependency,
              latestVersion: "4.0.0",
              latestSafeVersion: "3.23.8",
              hasMajorUpdate: true,
              status: "outdated" as const
            };
          case "typescript":
            return {
              ...dependency,
              latestVersion: "5.9.3",
              status: "upToDate" as const
            };
          case "vite":
            return {
              ...dependency,
              latestVersion: "5.4.0",
              status: "upToDate" as const
            };
          case "eslint":
            return {
              ...dependency,
              latestVersion: "9.0.0",
              status: "upToDate" as const
            };
          default:
            return dependency;
        }
      });
    }
  } as RegistryService;
}

function getTreeItemLabel(treeItem: vscode.TreeItem): string {
  return typeof treeItem.label === "string" ? treeItem.label : treeItem.label?.label ?? "";
}
