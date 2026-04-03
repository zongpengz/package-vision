import * as vscode from "vscode";

import { PackageJsonService } from "./services/packageJsonService";
import { DependencyTreeProvider } from "./views/dependencyTreeProvider";

export function activate(context: vscode.ExtensionContext): void {
  const packageJsonService = new PackageJsonService();
  const treeProvider = new DependencyTreeProvider(packageJsonService);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "packageVision.dependencies",
      treeProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("packageVision.refresh", async () => {
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
        treeProvider.refresh();
      }
    })
  );
}

export function deactivate(): void {}
