import * as vscode from "vscode";

import { DependencyRecord } from "./models/dependency";
import { PackageManagerService } from "./services/packageManagerService";
import { PackageJsonService } from "./services/packageJsonService";
import { RegistryService } from "./services/registryService";
import { DependencyTreeProvider } from "./views/dependencyTreeProvider";

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

  context.subscriptions.push(packageManagerService);

  context.subscriptions.push(
    // 把我们的数据提供器挂到 packageVision.dependencies 这个视图 ID 上。
    // 这个 ID 要和 package.json 里的 contributes.views 中的定义保持一致。
    vscode.window.registerTreeDataProvider(
      "packageVision.dependencies",
      treeProvider
    )
  );

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
    vscode.commands.registerCommand(
      "packageVision.openPackageJson",
      async () => {
        // 这里刻意只处理“工作区根目录”的 package.json，
        // 这是当前 MVP 的边界，先不扩展到 monorepo。
        const packageJsonUri = packageJsonService.getPackageJsonUri();
        if (!packageJsonUri || !(await packageJsonService.hasPackageJson())) {
          void vscode.window.showWarningMessage(
            "No package.json found in the workspace root."
          );
          return;
        }

        const document = await vscode.workspace.openTextDocument(packageJsonUri);
        await vscode.window.showTextDocument(document);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "packageVision.upgradeDependency",
      async (target: unknown) => {
        const dependency = resolveDependencyRecord(target);
        if (!dependency) {
          void vscode.window.showWarningMessage(
            "Package Vision could not determine which dependency to upgrade."
          );
          return;
        }

        if (!dependency.latestVersion || dependency.status !== "outdated") {
          void vscode.window.showInformationMessage(
            `${dependency.name} is already up to date or cannot be upgraded automatically yet.`
          );
          return;
        }

        const confirmAction = await vscode.window.showInformationMessage(
          `Upgrade ${dependency.name} from ${dependency.declaredVersion} to ${dependency.latestVersion}? This will update package.json and lock files.`,
          { modal: true },
          "Upgrade"
        );

        if (confirmAction !== "Upgrade") {
          return;
        }

        try {
          const result = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Upgrading ${dependency.name}...`
            },
            async () => packageManagerService.upgradeDependency(dependency)
          );

          treeProvider.refresh();
          void vscode.window.showInformationMessage(
            `Upgraded ${dependency.name} using ${result.packageManager}.`
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          const choice = await vscode.window.showErrorMessage(
            `Failed to upgrade ${dependency.name}: ${message}`,
            "Show Output"
          );

          if (choice === "Show Output") {
            packageManagerService.showOutput();
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      const rootPackageJsonUri = packageJsonService.getPackageJsonUri();
      if (
        rootPackageJsonUri &&
        document.uri.toString() === rootPackageJsonUri.toString()
      ) {
        // 当用户直接编辑并保存 package.json 时，侧边栏也要同步刷新，
        // 这样插件里的依赖列表不会停留在旧数据。
        treeProvider.refresh();
      }
    })
  );
}

export function deactivate(): void {}

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
