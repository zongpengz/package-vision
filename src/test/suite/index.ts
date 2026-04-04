import * as path from "node:path";
import * as fs from "node:fs/promises";

import Mocha from "mocha";

// 这是集成测试的 suite 入口。
// runTest.ts 负责启动 VS Code，而这里负责告诉 Mocha “要执行哪些测试文件”。
export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 30000
  });

  const testsRoot = __dirname;
  const testFiles = await collectTestFiles(testsRoot);

  for (const testFile of testFiles) {
    mocha.addFile(testFile);
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} integration test(s) failed.`));
        return;
      }

      resolve();
    });
  });
}

async function collectTestFiles(directoryPath: string): Promise<string[]> {
  // 自动递归收集 *.test.js，避免每新增一个集成测试文件都要手动注册。
  const directoryEntries = await fs.readdir(directoryPath, {
    withFileTypes: true
  });
  const filePaths = await Promise.all(
    directoryEntries.map(async (directoryEntry) => {
      const entryPath = path.join(directoryPath, directoryEntry.name);
      if (directoryEntry.isDirectory()) {
        return collectTestFiles(entryPath);
      }

      if (directoryEntry.isFile() && directoryEntry.name.endsWith(".test.js")) {
        return [entryPath];
      }

      return [];
    })
  );

  return filePaths.flat().sort((leftPath, rightPath) =>
    leftPath.localeCompare(rightPath)
  );
}
