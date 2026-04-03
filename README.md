# Package Vision

Package Vision 是一个计划中的 VS Code 扩展，目标是在编辑器左侧的 Activity Bar 中提供一个独立入口，用来查看前端项目依赖包的当前版本与最新版本，并支持对单个依赖执行升级操作。

当前仓库还没有开始写代码，这一阶段先把需求、技术路线和开发流程整理清楚。对于新手来说，这一步很重要，因为 VS Code 扩展开发同时涉及 `package.json` 清单、贡献点、命令、视图、调试方式和发布流程，先有文档会更容易稳定推进。

## 项目目标

- 在 Activity Bar 中提供一个与 Explorer、Search、Extensions 平级的入口
- 读取当前工作区的 `package.json`
- 展示依赖包的声明版本和最新版本
- 通过按钮或上下文操作升级指定依赖
- 让整个流程尽量接近 `npm outdated`，但在交互上更直观

## 推荐阅读顺序

1. [产品需求文档](/Users/zongpeng/Desktop/learning/package-vision/docs/product-requirements.md)
2. [技术设计文档](/Users/zongpeng/Desktop/learning/package-vision/docs/technical-design.md)
3. [开发流程文档](/Users/zongpeng/Desktop/learning/package-vision/docs/development-workflow.md)

## 当前建议的 MVP

第一版先聚焦在“单工作区根目录 + 单个 `package.json` + 单包升级”这条链路上，先把核心体验跑通：

- 左侧出现 `Package Vision` 入口
- 识别根目录 `package.json`
- 按 `dependencies` 和 `devDependencies` 分组展示依赖
- 展示包名、声明版本、最新版本、是否过时
- 支持刷新版本信息
- 支持升级某一个包并自动刷新

`peerDependencies`、`optionalDependencies`、`monorepo`、`升级全部`、`版本差异说明` 这些能力放在后续迭代会更稳妥。

## 技术路线摘要

- 扩展类型：桌面版 Node Extension
- 开发语言：TypeScript
- 侧边栏 UI：`View Container` + `Tree View`
- 最新版本来源：npm registry
- 升级动作：调用项目包管理器命令
- 调试方式：Extension Development Host

之所以不优先做 Web Extension，是因为升级依赖需要执行本地命令，而 Web Extension 运行在浏览器 Worker 环境中，不能创建子进程。

## 里程碑建议

1. 跑通一个最小可运行的 Hello World 扩展
2. 在 Activity Bar 中显示自定义入口
3. 用假数据渲染 Tree View
4. 读取 `package.json` 并展示真实依赖
5. 查询 npm registry，展示最新版本和状态
6. 实现单包升级
7. 补测试、打包、准备本地安装

## 文档清单

- [产品需求文档](/Users/zongpeng/Desktop/learning/package-vision/docs/product-requirements.md)：你到底要做什么、MVP 到哪里为止、用户场景是什么
- [技术设计文档](/Users/zongpeng/Desktop/learning/package-vision/docs/technical-design.md)：用哪些 VS Code API、模块怎么拆、数据怎么流动
- [开发流程文档](/Users/zongpeng/Desktop/learning/package-vision/docs/development-workflow.md)：如何从零初始化项目、调试、验证和分阶段实现

## 你接下来最适合做的事

- 先把需求文档读完，确认 MVP 边界是不是符合你的预期
- 再读技术设计，理解为什么左侧入口要用 Activity Bar 的 View Container
- 最后按开发流程文档初始化扩展骨架

如果你认可这套边界，下一步我们就可以直接在这个目录里继续帮你把扩展骨架也搭起来。
