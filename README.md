# Package Vision

Package Vision 是一个计划中的 VS Code 扩展，目标是在编辑器左侧的 Activity Bar 中提供一个独立入口，用来查看前端项目依赖包的当前版本与最新版本，并支持对单个依赖执行升级操作。

当前仓库已经包含一个最小可运行的 VS Code 扩展骨架，并保留了完整的需求、技术路线和开发流程文档。这样你既可以直接按 F5 开始调试，也可以对照文档理解每一部分为什么这样组织。

## 项目目标

- 在 Activity Bar 中提供一个与 Explorer、Search、Extensions 平级的入口
- 读取当前工作区的 `package.json`
- 展示依赖包的声明版本和最新版本
- 通过按钮或上下文操作升级指定依赖
- 让整个流程尽量接近 `npm outdated`，但在交互上更直观

## 推荐阅读顺序

1. [README.md](/Users/zongpeng/Desktop/learning/package-vision/README.md)
2. [产品需求文档](/Users/zongpeng/Desktop/learning/package-vision/docs/product-requirements.md)
3. [技术设计文档](/Users/zongpeng/Desktop/learning/package-vision/docs/technical-design.md)
4. [开发流程文档](/Users/zongpeng/Desktop/learning/package-vision/docs/development-workflow.md)

## 当前脚手架状态

目前已经完成的基础能力：

- TypeScript 扩展入口和编译配置
- `.vscode/launch.json` 与 `.vscode/tasks.json`
- Activity Bar 中的 `Package Vision` 入口
- 一个 `Dependencies` Tree View
- 读取工作区根目录 `package.json` 的基础服务
- 按 `dependencies` 和 `devDependencies` 展示声明版本
- 查询 npm registry 的最新版本
- 标记依赖的基础状态，例如是否过时
- 对过时依赖执行单包升级
- 刷新视图和打开 `package.json` 的基础命令

这意味着现在已经不是单纯的空骨架，而是一个“可运行、可看到侧边栏、能读基础数据”的起点。

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

## 本地运行

```bash
npm install
npm run compile
```

然后在 VS Code 中打开这个目录，按 `F5` 启动 `Extension Development Host`。

启动后你会看到：

- 左侧 Activity Bar 出现 `Package Vision`
- 视图中展示当前工作区根目录 `package.json` 的依赖分组
- 每个依赖显示声明版本和最新版本
- 过时依赖支持点击升级，并提供右键菜单入口
- 视图标题上有刷新和打开 `package.json` 的按钮

## 里程碑建议

1. 细化 Tree View 的数据模型和状态展示
2. 增强错误处理和加载反馈
3. 支持更多包管理器
4. 补设置项和测试
5. 打包并准备本地安装验证

## 文档清单

- [产品需求文档](/Users/zongpeng/Desktop/learning/package-vision/docs/product-requirements.md)：你到底要做什么、MVP 到哪里为止、用户场景是什么
- [技术设计文档](/Users/zongpeng/Desktop/learning/package-vision/docs/technical-design.md)：用哪些 VS Code API、模块怎么拆、数据怎么流动
- [开发流程文档](/Users/zongpeng/Desktop/learning/package-vision/docs/development-workflow.md)：如何从零初始化项目、调试、验证和分阶段实现

## 你接下来最适合做的事

- 先按 `F5` 跑起来，确认你已经看到了侧边栏入口和依赖树
- 再读技术设计，理解当前骨架为什么拆成 `services`、`views`、`models`
- 然后继续做“查询最新版本”这一层能力

如果你愿意，下一步我可以继续把“最新版本查询 + 过时状态显示”这一层也接上。
