import * as vscode from "vscode";
import * as path from "node:path";
import * as semver from "semver";

import { getMajorUpdateStrategy } from "./configuration";
import type { DependencyRecord, PackageManifestRecord } from "./models/dependency";
import { PackageManagerService } from "./services/packageManagerService";
import { PackageJsonService } from "./services/packageJsonService";
import { getComparableDeclaredVersion } from "./services/registryUtils";
import { RegistryService } from "./services/registryService";
import type {
  UpgradeChoice
} from "./services/upgradeStrategyUtils";
import {
  buildMajorAwareUpgradeChoices,
  getSafeUpgradeTargetVersion
} from "./services/upgradeStrategyUtils";
import { DependencyTreeProvider } from "./views/dependencyTreeProvider";
import type {
  DependencyFilterMode} from "./views/dependencyFilterUtils";
import {
  formatDependencyFilterLabel
} from "./views/dependencyFilterUtils";

// extension.ts 是扩展的“组装层”。
// 真正的业务细节分散在 services 和 views 里，而这里负责：
// 1. 创建对象
// 2. 注册命令
// 3. 监听 VS Code 事件
// 4. 协调跨模块流程
export function activate(context: vscode.ExtensionContext): void {
  // activate() 是扩展真正“启动”的地方。
  // VS Code 在满足 activationEvents 后会调用这里，我们通常在这里注册命令、视图和事件监听。
  const packageJsonService = new PackageJsonService();
  const registryService = new RegistryService();
  const packageManagerService = new PackageManagerService(packageJsonService);
  const treeProvider = new DependencyTreeProvider(
    packageJsonService,
    registryService
  );
  const dependencyTreeView = vscode.window.createTreeView(
    "packageVision.dependencies",
    {
      treeDataProvider: treeProvider
    }
  );

  context.subscriptions.push(packageManagerService);
  context.subscriptions.push(dependencyTreeView);

  context.subscriptions.push(
    treeProvider.onDidChangeTreeData(() => {
      // 过滤器标签属于 Tree View 外层的显示状态，
      // 所以当树节点刷新时，也要顺手同步视图描述和上下文变量。
      syncFilterPresentation(treeProvider, dependencyTreeView);
    })
  );
  syncFilterPresentation(treeProvider, dependencyTreeView);

  context.subscriptions.push(
    vscode.commands.registerCommand("packageVision.refresh", async () => {
      // TreeDataProvider 本身不保存 UI 状态，刷新本质上是通知 VS Code 重新调用 getChildren()。
      treeProvider.refresh();
      vscode.window.setStatusBarMessage(
        "Package Vision refreshed dependency data.",
        2500
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("packageVision.setFilter", async () => {
      // 筛选本身由 treeProvider 持有；
      // 入口层只负责把 Quick Pick 结果传给 provider。
      const selection = await vscode.window.showQuickPick(
        buildFilterQuickPickItems(treeProvider.getFilterMode()),
        {
          placeHolder: "Filter dependencies by status"
        }
      );
      if (!selection) {
        return;
      }

      treeProvider.setFilterMode(selection.filterMode);
      syncFilterPresentation(treeProvider, dependencyTreeView);

      vscode.window.setStatusBarMessage(
        selection.filterMode === "all"
          ? "Package Vision cleared the dependency filter."
          : `Package Vision filter: ${selection.label}`,
        2500
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("packageVision.clearFilter", () => {
      treeProvider.setFilterMode("all");
      syncFilterPresentation(treeProvider, dependencyTreeView);
      vscode.window.setStatusBarMessage(
        "Package Vision cleared the dependency filter.",
        2500
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "packageVision.openPackageJson",
      async () => {
        // 这里刻意只处理“工作区根目录”的 package.json，
        // monorepo 模式下，如果存在多个 package.json，会先让用户选择要打开哪一个。
        const packageManifest = await resolvePackageManifest(
          packageJsonService
        );
        if (!packageManifest) {
          void vscode.window.showWarningMessage(
            "No package.json files found in the workspace."
          );
          return;
        }

        const document = await vscode.workspace.openTextDocument(
          vscode.Uri.file(packageManifest.packageJsonPath)
        );
        await vscode.window.showTextDocument(document);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "packageVision.upgradeDependency",
      async (target: unknown) => {
        await handleUpgradeCommand(
          target,
          "default",
          treeProvider,
          packageManagerService
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "packageVision.upgradeDependencyToLatestMajor",
      async (target: unknown) => {
        await handleUpgradeCommand(
          target,
          "latestMajor",
          treeProvider,
          packageManagerService
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("packageVision.showOutput", () => {
      packageManagerService.showOutput();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (
        document.uri.scheme === "file" &&
        path.basename(document.uri.fsPath) === "package.json"
      ) {
        // 当用户直接编辑并保存 package.json 时，侧边栏也要同步刷新，
        // 这样插件里的依赖列表不会停留在旧数据。
        treeProvider.refresh();
      }
    })
  );
}

export function deactivate(): void {}

async function handleUpgradeCommand(
  target: unknown,
  mode: "default" | "latestMajor",
  treeProvider: DependencyTreeProvider,
  packageManagerService: PackageManagerService
): Promise<void> {
  // 命令参数既可能直接是 DependencyRecord，
  // 也可能是 Tree Item 上挂的包装对象，所以先统一解析。
  const dependency = resolveDependencyRecord(target);
  if (!dependency) {
    void vscode.window.showWarningMessage(
      "Package Vision could not determine which dependency to upgrade."
    );
    return;
  }

  if (treeProvider.isDependencyUpgrading(dependency)) {
    void vscode.window.showInformationMessage(
      `${dependency.name} is already being upgraded.`
    );
    return;
  }

  if (!dependency.latestVersion || dependency.status !== "outdated") {
    void vscode.window.showInformationMessage(
      `${dependency.name} is already up to date or cannot be upgraded automatically yet.`
    );
    return;
  }

  const upgradeChoice = await resolveUpgradeChoice(dependency, mode);
  if (!upgradeChoice) {
    // 用户取消选择、或者当前策略下没有合适目标时，都属于正常退出。
    return;
  }

  const confirmAction = await vscode.window.showInformationMessage(
    buildUpgradeConfirmationMessage(dependency, upgradeChoice),
    { modal: true },
    upgradeChoice.isMajorUpdate ? "Upgrade Major Version" : "Upgrade"
  );

  if (
    confirmAction !== "Upgrade" &&
    confirmAction !== "Upgrade Major Version"
  ) {
    return;
  }

  treeProvider.startUpgrade(dependency);

  try {
    // withProgress 会把升级过程放到通知区，给用户一个明确的正在执行反馈。
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Upgrading ${dependency.name}...`
      },
      async (progress) => {
        progress.report({
          message: `Running package manager command for ${upgradeChoice.targetVersion}...`
        });

        const upgradeResult = await packageManagerService.upgradeDependency(
          dependency,
          upgradeChoice.targetVersion
        );

        progress.report({
          increment: 80,
          message: "Refreshing dependency tree..."
        });

        return upgradeResult;
      }
    );

    treeProvider.finishUpgrade(dependency);
    const choice = await vscode.window.showInformationMessage(
      `Upgraded ${dependency.name} to ${result.targetVersion} using ${result.packageManager}. Saved as ${result.savedVersionRange}.`,
      "Show Output",
      "Open package.json"
    );

    if (choice === "Show Output") {
      packageManagerService.showOutput();
    }

    if (choice === "Open package.json") {
      await vscode.commands.executeCommand("packageVision.openPackageJson");
    }
  } catch (error) {
    treeProvider.finishUpgrade(dependency);
    const message = error instanceof Error ? error.message : "Unknown error";
    const choice = await vscode.window.showErrorMessage(
      `Failed to upgrade ${dependency.name}: ${message}`,
      "Show Output",
      "Retry"
    );

    if (choice === "Show Output") {
      packageManagerService.showOutput();
    }

    if (choice === "Retry") {
      await vscode.commands.executeCommand(
        mode === "latestMajor"
          ? "packageVision.upgradeDependencyToLatestMajor"
          : "packageVision.upgradeDependency",
        dependency
      );
    }
  }
}

async function resolveUpgradeChoice(
  dependency: DependencyRecord,
  mode: "default" | "latestMajor"
): Promise<UpgradeChoice | undefined> {
  // 这个函数的职责是：
  // 根据“命令模式 + 当前配置 + 依赖状态”推导出真正要执行的升级目标版本。
  if (mode === "latestMajor") {
    if (!dependency.hasMajorUpdate || !dependency.latestVersion) {
      void vscode.window.showInformationMessage(
        `${dependency.name} does not currently have a newer major version to upgrade to.`
      );
      return undefined;
    }

    return {
      upgradeKind: "latestMajor",
      targetVersion: dependency.latestVersion,
      label: `Upgrade to latest major ${dependency.latestVersion}`,
      description: "May include breaking changes",
      detail:
        "Use this when you intentionally want the newest published major version.",
      isMajorUpdate: true
    };
  }

  const configurationScope = vscode.Uri.file(
    dependency.packageManifest.packageJsonPath
  );
  // 把 package.json 路径作为配置 scope 传进去后，
  // VS Code 能按具体资源位置解析设置值。
  const strategy = getMajorUpdateStrategy(configurationScope);
  const safeUpgradeTarget = getSafeUpgradeTargetVersion(dependency);

  if (!dependency.hasMajorUpdate || !dependency.latestVersion) {
    const targetVersion = safeUpgradeTarget ?? dependency.latestVersion;
    if (!targetVersion) {
      return undefined;
    }

    return {
      upgradeKind: "latest",
      targetVersion,
      label: `Upgrade to ${targetVersion}`,
      description: "Upgrade dependency",
      detail: "Upgrade to the newest available version for this dependency.",
      isMajorUpdate: false
    };
  }

  switch (strategy) {
    case "latest":
      return {
        upgradeKind: "latestMajor",
        targetVersion: dependency.latestVersion,
        label: `Upgrade to latest major ${dependency.latestVersion}`,
        description: "Uses the newest published version",
        detail: "This may include breaking changes.",
        isMajorUpdate: true
      };
    case "safe":
      if (safeUpgradeTarget) {
        return {
          upgradeKind: "safe",
          targetVersion: safeUpgradeTarget,
          label: `Upgrade within current major to ${safeUpgradeTarget}`,
          description: "Recommended safe default",
          detail: "Keeps the current major version when possible.",
          isMajorUpdate: false
        };
      }

      {
        const action = await vscode.window.showInformationMessage(
          `${dependency.name} has no newer version within the current major. Use "Upgrade to Latest Major" from the inline action or context menu, or change packageVision.upgrade.majorUpdateStrategy if you want to allow major upgrades by default.`,
          "Open Settings"
        );

        if (action === "Open Settings") {
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "packageVision.upgrade.majorUpdateStrategy"
          );
        }
      }

      return undefined;
    case "ask":
    default: {
      // ask 模式是最适合学习和日常使用的默认值：
      // 既不会偷偷升 major，也能让用户理解“safe / major”两条路径的差别。
      const choices = buildMajorAwareUpgradeChoices(dependency);
      if (choices.length === 1) {
        return choices[0];
      }

      const selection = await vscode.window.showQuickPick(
        choices.map((choice) => ({
          label: choice.label,
          description: choice.description,
          detail: choice.detail,
          upgradeChoice: choice
        })),
        {
          placeHolder: `Choose how to upgrade ${dependency.name}`
        }
      );

      return selection?.upgradeChoice;
    }
  }
}

function buildUpgradeConfirmationMessage(
  dependency: DependencyRecord,
  upgradeChoice: UpgradeChoice
): string {
  // 确认文案会根据是否 major update 给出不同程度的风险提示。
  if (upgradeChoice.isMajorUpdate) {
    return `Upgrade ${dependency.name} from ${dependency.declaredVersion} to ${upgradeChoice.targetVersion}? This is a major version change and may require code updates. Package Vision will update package.json and lock files.`;
  }

  const comparableDeclaredVersion = getComparableDeclaredVersion(
    dependency.declaredVersion
  );
  const sameMajorMessage =
    comparableDeclaredVersion && semver.valid(upgradeChoice.targetVersion)
      ? `This stays on major ${semver.major(comparableDeclaredVersion)}. `
      : "";

  return `Upgrade ${dependency.name} from ${dependency.declaredVersion} to ${upgradeChoice.targetVersion}? ${sameMajorMessage}Package Vision will update package.json and lock files.`;
}

function resolveDependencyRecord(target: unknown): DependencyRecord | undefined {
  if (isDependencyRecord(target)) {
    return target;
  }

  if (
    typeof target === "object" &&
    target !== null &&
    "dependency" in target &&
    isDependencyRecord(target.dependency)
  ) {
    return target.dependency;
  }

  return undefined;
}

function isDependencyRecord(value: unknown): value is DependencyRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "section" in value &&
    "declaredVersion" in value &&
    "status" in value
  );
}

async function resolvePackageManifest(
  packageJsonService: PackageJsonService
): Promise<PackageManifestRecord | undefined> {
  const manifests = await packageJsonService.loadPackageManifests();
  if (manifests.length === 0) {
    return undefined;
  }

  if (manifests.length === 1) {
    // 单包项目不打扰用户，直接返回。
    return manifests[0];
  }

  // 多 package.json 场景下再让用户选，这样单仓库和 monorepo 的体验都比较自然。
  const selection = await vscode.window.showQuickPick(
    manifests.map((manifest) => ({
      label: manifest.displayName,
      description:
        manifest.relativeDirPath === "."
          ? "workspace root"
          : manifest.relativeDirPath,
      detail: manifest.packageJsonPath,
      manifest
    })),
    {
      placeHolder: "Select a package.json to open"
    }
  );

  return selection?.manifest;
}

function buildFilterQuickPickItems(currentFilterMode: DependencyFilterMode): Array<{
  label: string;
  description?: string;
  filterMode: DependencyFilterMode;
}> {
  const filterModes: DependencyFilterMode[] = [
    "all",
    "outdated",
    "upToDate",
    "error",
    "unknown",
    "upgrading"
  ];

  return filterModes.map((filterMode) => ({
    label: formatDependencyFilterLabel(filterMode),
    description:
      filterMode === currentFilterMode ? "Current filter" : undefined,
    filterMode
  }));
}

function syncFilterPresentation(
  treeProvider: DependencyTreeProvider,
  dependencyTreeView: vscode.TreeView<unknown>
): void {
  // setContext 会影响 package.json 里 menus 的 when 条件。
  // 这就是“有筛选时显示 Clear Filter 按钮”的实现基础。
  dependencyTreeView.description = treeProvider.getFilterLabel();
  void vscode.commands.executeCommand(
    "setContext",
    "packageVision.hasActiveFilter",
    treeProvider.hasActiveFilter()
  );
}
