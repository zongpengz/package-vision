# Package Vision

Package Vision 让你直接在 VS Code 左侧栏查看依赖的当前版本、最新版本和升级状态。

你可以在不离开编辑器的情况下快速找出过时依赖、按状态筛选、并执行单包升级。它适合日常维护前端项目，也支持 monorepo 和多个 `package.json` 的场景。

已发布到 VS Code Marketplace：

- https://marketplace.visualstudio.com/items?itemName=zongpengz.package-vision

## 安装

1. 在 VS Code 扩展市场搜索 `Package Vision`
2. 或直接打开 Marketplace 页面安装

## 功能亮点

- 在 Activity Bar 提供独立入口，不用切到终端也能检查依赖
- 扫描当前工作区中的一个或多个 `package.json`
- 直接对比当前声明版本和最新版本，快速看出哪些包已经过时
- 清楚区分 `dependencies` 和 `devDependencies`
- 用状态图标区分已最新、过时、查询失败、无法比较和升级中
- 支持按状态快速筛选，只看你现在最关心的包
- 支持通过点击、悬浮图标和右键菜单升级单个依赖
- 遇到大版本升级时，支持先询问、默认保守升级，或显式升级到最新 major
- 支持 `npm`、`pnpm`、`yarn`、`bun`
- 支持 monorepo 和多个 `package.json`
- 支持配置升级后的版本范围写回策略：`preserve`、`caret`、`tilde`、`exact`
- 提供输出日志，方便定位升级过程中的问题

## 当前支持范围

- 包管理器：`npm`、`pnpm`、`yarn`、`bun`
- 工作区类型：单 package 项目、monorepo / 多个 `package.json`
- 依赖类型：`dependencies`、`devDependencies`

## 使用方式

1. 在 VS Code 左侧打开 `Package Vision`
2. 查看依赖的声明版本、最新版本和状态
3. 需要时用顶部筛选按钮快速缩小范围
4. 点击过时依赖，确认后执行升级
5. 也可以通过包项悬浮图标或右键菜单执行升级操作
6. 对存在大版本更新的包，可以使用悬浮图标或右键菜单显式升级到最新 major

## Screenshots

![Overview](./docs/images/marketplace/overview.png)
![Filter outdated packages](./docs/images/marketplace/filter-outdated.png)
![Upgrade single package](./docs/images/marketplace/upgrade-single-package.png)

## 设置项

当前提供两个设置项：

- `packageVision.upgrade.majorUpdateStrategy`
- `packageVision.upgrade.versionRangeStyle`

可选值：

- `ask`
- `safe`
- `latest`
- `preserve`
- `caret`
- `tilde`
- `exact`

其中：

- `packageVision.upgrade.majorUpdateStrategy` 控制遇到大版本升级时，是先询问、默认保守升级，还是直接升到最新 major
- `packageVision.upgrade.versionRangeStyle` 控制升级后写回到 `package.json` 的版本范围风格

## 开发与文档

如果你是这个仓库的维护者，或者想通过这个项目学习 VS Code 扩展开发，建议从这些文档开始：

- [产品需求文档](./docs/product-requirements.md)
- [代码导读与目录结构](./docs/codebase-guide.md)
- [技术设计文档](./docs/technical-design.md)
- [开发流程文档](./docs/development-workflow.md)
- [项目复盘文档](./docs/project-retrospective.md)
- [测试与验证文档](./docs/testing-and-validation.md)
- [Marketplace 发布文档](./docs/marketplace-publishing.md)

## 发布状态

`0.1.0` 已于 `2026-04-04` 发布到 VS Code Marketplace。
