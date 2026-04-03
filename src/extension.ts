import * as vscode from "vscode";

import { PackageJsonService } from "./services/packageJsonService";
import { RegistryService } from "./services/registryService";
import { DependencyTreeProvider } from "./views/dependencyTreeProvider";

export function activate(context: vscode.ExtensionContext): void {
  // activate() 是扩展真正“启动”的地方。
  // VS Code 在满足 activationEvents 后会调用这里，我们通常在这里注册命令、视图和事件监听。
  const packageJsonService = new PackageJsonService();
  const registryService = new RegistryService();
  const treeProvider = new DependencyTreeProvider(
    packageJsonService,
    registryService
  );

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
