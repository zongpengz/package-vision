import * as assert from "node:assert/strict";

import * as vscode from "vscode";

import type { DependencyRecord } from "../../models/dependency";
import { PackageJsonService } from "../../services/packageJsonService";
import type { RegistryService } from "../../services/registryService";
import { DependencyTreeProvider } from "../../views/dependencyTreeProvider";

// 这一组测试不追求覆盖所有细节，而是验证“扩展在 VS Code 里能不能基本跑通”。
// 所以它更像冒烟测试：
// - 命令有没有注册
// - fixture 工作区能不能被扫描到
// - Tree View 的主要分组和筛选有没有明显回归
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
    assert.ok(commands.includes("packageVision.setSearch"));
    assert.ok(commands.includes("packageVision.clearSearch"));
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
    assert.equal(emptyStateItem.description, "Filter: Lookup Failed");
  });

  test("combines search with the current filter before rendering the tree", async () => {
    const treeProvider = new DependencyTreeProvider(
      new PackageJsonService(),
      createStubRegistryService()
    );
    treeProvider.setFilterMode("outdated");
    treeProvider.setSearchQuery("react");

    const topLevelNodes = await treeProvider.getChildren();
    const topLevelLabels = topLevelNodes.map((node) =>
      getTreeItemLabel(treeProvider.getTreeItem(node))
    );

    assert.deepEqual(topLevelLabels, ["@fixture/web"]);
    assert.equal(treeProvider.getViewDescription(), "Outdated • Search: react");
  });

  test("shows an empty state when no dependency matches the active search", async () => {
    const treeProvider = new DependencyTreeProvider(
      new PackageJsonService(),
      createStubRegistryService()
    );
    treeProvider.setSearchQuery("svelte");

    const topLevelNodes = await treeProvider.getChildren();
    assert.equal(topLevelNodes.length, 1);

    const emptyStateItem = treeProvider.getTreeItem(topLevelNodes[0]);
    assert.equal(
      getTreeItemLabel(emptyStateItem),
      "No dependencies match the current search."
    );
    assert.equal(emptyStateItem.description, "Search: svelte");
  });

  test("refresh and output commands execute without throwing", async () => {
    await vscode.commands.executeCommand("packageVision.refresh");
    await vscode.commands.executeCommand("packageVision.showOutput");
  });
});

function createStubRegistryService(): RegistryService {
  // 集成测试这里故意不用真实网络请求，
  // 这样测试会更稳定，也更聚焦在扩展本身的行为。
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
