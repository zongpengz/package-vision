# 代码导读与目录结构

这份文档专门面向“想通过这个项目学习 VS Code 插件开发”的读者。

如果你第一次看这个仓库，最推荐的方式不是从某个零散函数开始，而是先理解：

1. 目录怎么分层
2. 哪些文件是入口
3. 一条功能链路会穿过哪些模块

## 1. 推荐阅读顺序

最推荐按下面顺序读：

1. `package.json`
2. `src/extension.ts`
3. `src/views/dependencyTreeProvider.ts`
4. `src/services/packageJsonService.ts`
5. `src/services/registryService.ts`
6. `src/services/packageManagerService.ts`
7. `src/services/packageManagerCore.ts`
8. `src/test/runTest.ts` 和 `src/test/suite/extension.integration.test.ts`

这个顺序的好处是：

- 先看扩展如何被 VS Code 识别
- 再看命令和视图如何注册
- 再看数据如何读取、增强、展示
- 最后看升级命令和测试链路

## 2. 目录结构总览

```text
package-vision/
  .vscode/
    launch.json
    tasks.json
  docs/
    codebase-guide.md
    development-workflow.md
    marketplace-publishing.md
    marketplace-release-checklist.md
    product-requirements.md
    project-retrospective.md
    technical-design.md
    testing-and-validation.md
    images/
      marketplace/
  resources/
    marketplace-icon.png
    package-vision.svg
    upgrade-dark.svg
    upgrade-light.svg
  src/
    configuration.ts
    extension.ts
    models/
      dependency.ts
    services/
      packageJsonService.ts
      packageManifestUtils.ts
      packageManagerCore.ts
      packageManagerService.ts
      registryService.ts
      registryUtils.ts
      upgradeStrategyUtils.ts
      versionRangeUtils.ts
    test/
      runTest.ts
      fixtures/
        monorepo/
      suite/
        extension.integration.test.ts
        index.ts
    views/
      dependencyFilterUtils.ts
      dependencyTreeProvider.ts
  tests/
    dependencyFilterUtils.test.ts
    packageManagerCore.test.ts
    packageManifestUtils.test.ts
    registryUtils.test.ts
    upgradeStrategyUtils.test.ts
    versionRangeUtils.test.ts
  package.json
  tsconfig.json
  tsconfig.tests.json
  eslint.config.mjs
```

## 3. 根目录文件的作用

### `package.json`

这是 VS Code 插件的清单文件，也是最重要的入口之一。

它负责声明：

- 扩展名称、版本、publisher
- Activity Bar 入口
- 视图
- 命令
- 菜单
- 设置项
- npm scripts

如果你问“为什么左侧会出现这个入口”，答案通常先去看这里。

### `tsconfig.json`

这是主源码的 TypeScript 配置，服务于 `src/` 下的扩展运行时代码。

### `tsconfig.tests.json`

这是测试相关的 TypeScript 配置，额外把 `tests/` 和 `src/test/` 也纳入类型检查。

### `eslint.config.mjs`

这是项目当前的 ESLint 配置，用来做基础静态检查。

## 4. `src/` 目录怎么理解

### `src/extension.ts`

这是扩展入口。

它的主要职责是：

- 创建 service 和 provider
- 注册命令
- 注册视图
- 监听保存事件
- 协调“升级依赖”这类跨层动作

可以把它理解成“组装层”。

### `src/models/`

这里放项目共享的数据模型。

当前最核心的是：

- `PackageManifestRecord`
- `DependencyRecord`

这两个类型会贯穿 service、view 和 test。

### `src/services/`

这里放业务逻辑。

当前可以再细分成四类：

- 本地文件读取
  - `packageJsonService.ts`
  - `packageManifestUtils.ts`
- 在线版本信息
  - `registryService.ts`
  - `registryUtils.ts`
- 升级策略与版本范围
  - `upgradeStrategyUtils.ts`
  - `versionRangeUtils.ts`
  - `configuration.ts`
- 包管理器执行
  - `packageManagerService.ts`
  - `packageManagerCore.ts`

一个很好用的阅读方法是：

- 先看 `Service`
- 再看和它配套的 `Utils`

因为通常 Service 负责流程，Utils 负责纯逻辑。

### `src/views/`

这里放视图层代码。

最核心的是：

- `dependencyTreeProvider.ts`

它负责把依赖数据组织成 Tree View 节点。

另一个文件：

- `dependencyFilterUtils.ts`

负责和筛选相关的纯逻辑。

### `src/test/`

这里放 Extension Host 集成测试相关代码。

- `runTest.ts`
  负责启动 VS Code 测试进程
- `suite/index.ts`
  负责收集并执行测试文件
- `suite/extension.integration.test.ts`
  负责真正的集成测试断言
- `fixtures/monorepo/`
  提供稳定的测试工作区样例

## 5. `tests/` 目录怎么理解

这里放的是“纯逻辑单元测试”。

它和 `src/test/` 的区别是：

- `tests/` 测的是纯函数和纯逻辑
- `src/test/` 测的是扩展在 VS Code 里的真实运行链路

所以：

- 单元测试更快
- 集成测试更接近真实使用

## 6. 一条完整功能链路是怎么流动的

以“查看依赖并升级一个包”为例，完整链路是：

1. VS Code 读取 `package.json`
2. 用户打开左侧 `Package Vision`
3. `src/extension.ts` 创建 `DependencyTreeProvider`
4. `DependencyTreeProvider` 调用 `PackageJsonService` 读取本地依赖
5. `RegistryService` 为依赖补充最新版本和状态
6. `DependencyTreeProvider` 把数据转换成 Tree Item
7. 用户点击某个依赖
8. `src/extension.ts` 处理命令并决定升级策略
9. `PackageManagerService` 识别包管理器并执行命令
10. `PackageJsonService` 负责必要时写回 `package.json`
11. Tree View 刷新，显示新的状态

## 7. 你读代码时最该关注什么

如果你是为了学习 VS Code 插件开发，建议重点注意这些点：

- `package.json` 如何声明视图、命令和菜单
- `activate()` 如何把各层串起来
- TreeDataProvider 的 `getChildren()` 如何决定树结构
- 纯逻辑为什么要拆到 `utils`
- 为什么测试要分成单元测试和 Extension Host 集成测试

## 8. 一个很实用的阅读技巧

不要试图第一次就把所有文件都读懂。

更好的方式是：

1. 先选一条用户功能
2. 顺着调用链往下看
3. 只在遇到不懂的数据结构时，再跳去看类型定义

例如你想理解“升级依赖”：

1. 先看 `src/extension.ts`
2. 再看 `src/services/packageManagerService.ts`
3. 再看 `src/services/packageManagerCore.ts`
4. 最后看 `src/services/versionRangeUtils.ts`

这样会比无目标地翻目录高效很多。
