import * as cp from "node:child_process";
import * as path from "node:path";

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath
} from "@vscode/test-electron";

// 这个文件是“集成测试启动器”。
// 它不会直接写断言，而是负责把一个真正的 VS Code 实例拉起来，
// 再把测试入口和 fixture 工作区交给那个实例执行。
async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../..");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const fixtureWorkspacePath = path.join(
      extensionDevelopmentPath,
      "src",
      "test",
      "fixtures",
      "monorepo"
    );

    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const [cliPath, ...cliArgs] =
      resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    // 这里改走 VS Code CLI，而不是直接调用 runTests。
    // 原因是当前 macOS + Electron 下载产物下，launchArgs 会被前置到错误的位置，
    // 导致工作区路径和 --disable-extensions 被 Electron 本身误解析。
    const args = [
      ...cliArgs,
      "--disable-extensions",
      "--disable-updates",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      fixtureWorkspacePath,
      `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
      `--extensionTestsPath=${extensionTestsPath}`
    ];

    await runCommand(cliPath, args);
    console.log("Package Vision integration tests completed successfully.");
  } catch (error) {
    console.error(error);
    console.error("Failed to run Package Vision integration tests.");
    process.exit(1);
  }
}

function runCommand(executablePath: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 这里直接转发 stdout / stderr，
    // 这样集成测试失败时，你能在终端里看到接近真实 VS Code 启动过程的日志。
    const command = cp.spawn(executablePath, args, {
      shell: process.platform === "win32"
    });

    command.stdout.on("data", (chunk) => process.stdout.write(chunk));
    command.stderr.on("data", (chunk) => process.stderr.write(chunk));
    command.on("error", reject);
    command.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Integration test process exited with code ${code}.`));
    });
  });
}

void main();
