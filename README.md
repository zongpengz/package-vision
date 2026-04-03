# Package Vision

Package Vision 是一个计划中的 VS Code 扩展，目标是在编辑器左侧的 Activity Bar 中提供一个独立入口，用来查看前端项目依赖包的当前版本与最新版本，并支持对单个依赖执行升级操作。

当前仓库已经包含一个最小可运行的 VS Code 扩展骨架，并保留了完整的需求、技术路线和开发流程文档。这样你既可以直接按 F5 开始调试，也可以对照文档理解每一部分为什么这样组织。

## 项目目标

- 在 Activity Bar 中提供一个与 Explorer、Search、Extensions 平级的入口
- 扫描当前工作区中的一个或多个 `package.json`
- 展示依赖包的声明版本和最新版本
- 通过按钮或上下文操作升级指定依赖
- 让整个流程尽量接近 `npm outdated`，但在交互上更直观

## 推荐阅读顺序

1. `README.md`（当前文件）
2. [产品需求文档](./docs/product-requirements.md)
3. [技术设计文档](./docs/technical-design.md)
4. [开发流程文档](./docs/development-workflow.md)

## 当前脚手架状态

目前已经完成的基础能力：

- TypeScript 扩展入口和编译配置
- `.vscode/launch.json` 与 `.vscode/tasks.json`
- Activity Bar 中的 `Package Vision` 入口
- 一个 `Dependencies` Tree View
- 扫描工作区中的多个 `package.json`
- 按包清单和 `dependencies` / `devDependencies` 展示声明版本
- 查询 npm registry 的最新版本
- 标记依赖的基础状态，例如是否过时
- 对过时依赖执行单包升级
- 提供升级输出日志和更明确的升级反馈
- 自动升级当前支持 `npm`、`pnpm`、`yarn` 和 `bun`
- 在 monorepo 中按目标包所在目录执行升级命令
- 支持升级后版本范围写回策略，例如保留 `^ / ~ / exact`
- 提供按状态的快速筛选
- 使用彩色状态图标区分不同依赖状态
- 刷新视图和打开 `package.json` 的基础命令

这意味着现在已经不是单纯的空骨架，而是一个“可运行、可看到侧边栏、能读基础数据”的起点。

当前自动升级支持范围：

- `npm`
- `pnpm`
- `yarn`
- `bun`

## 当前建议的 MVP

当前这版 MVP 已经覆盖到“单工作区 + 多个 `package.json` + 单包升级”这条主链路：

- 左侧出现 `Package Vision` 入口
- 扫描工作区中的多个 `package.json`
- 单包项目时直接展示依赖分组
- 多包项目时先按 package 分组，再展示 `dependencies` 和 `devDependencies`
- 展示包名、声明版本、最新版本、是否过时
- 支持刷新版本信息
- 支持升级某一个包并自动刷新
- 在 monorepo 中尽量在正确的工作目录里执行升级命令

`peerDependencies`、`optionalDependencies`、`升级全部`、`版本差异说明`、`workspace 协议的更精细处理` 这些能力放在后续迭代会更稳妥。

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
npm test
npm run test:integration
```

然后在 VS Code 中打开这个目录，按 `F5` 启动 `Extension Development Host`。

如果你想在提交前做一次快速自检，可以直接运行：

```bash
npm run check
```

如果你想把 Extension Host 集成测试也一起跑掉，可以执行：

```bash
npm run check:full
```

当前测试分成两层：

- 单元测试：跑纯逻辑模块，速度快，适合日常开发
- 集成测试：在 Extension Development Host 中运行，验证扩展命令、工作区扫描和 Tree View 主链路

当前单元测试主要覆盖这些“纯逻辑”模块：

- 版本状态判断，例如 `upToDate` / `outdated` / `unknown`
- package manifest 的组装和依赖展开
- monorepo 场景下各个包管理器的升级命令构造
- 升级后的版本范围写回策略
- 依赖状态快速筛选逻辑

当前集成测试主要覆盖这些“扩展主链路”：

- 扩展命令是否注册成功
- 多个 `package.json` 的工作区扫描
- Tree View 在 monorepo 下的分组渲染
- 快速筛选在真实 Extension Host 中的结果

这样做的好处是：日常改动可以先靠单元测试快速回归，而关键链路再由集成测试兜底。

## 设置项

当前已经提供一个可配置项：

- `packageVision.upgrade.versionRangeStyle`

可选值：

- `preserve`：尽量保留当前依赖原本的写法，例如 `^`、`~` 或 exact
- `caret`：统一写成 `^1.2.3`
- `tilde`：统一写成 `~1.2.3`
- `exact`：统一写成 `1.2.3`

这个设置是按工作区资源生效的，适合不同项目使用不同的版本策略。

## 快速筛选

Dependencies 视图标题栏现在提供了快速筛选按钮。

你可以按状态快速切换查看：

- `All`
- `Outdated`
- `Up To Date`
- `Lookup Failed`
- `Unable To Compare`
- `Upgrading`

筛选后会同时影响 package 分组、依赖分组和具体依赖项；如果当前没有匹配结果，视图里会显示明确的空状态提示。

启动后你会看到：

- 左侧 Activity Bar 出现 `Package Vision`
- 单 package 项目会直接展示依赖分组
- monorepo / 多 package 项目会先展示每个 `package.json`，再展开依赖分组
- 每个依赖显示声明版本和最新版本
- 依赖状态图标会按状态着色，便于快速扫视
- 过时依赖支持点击升级，并提供右键菜单入口
- 升级中的依赖会显示进行中状态
- 视图标题上提供快速筛选按钮，可按状态过滤依赖
- 打开 `package.json` 时，如果工作区里有多个清单，会先让你选择目标文件
- 视图标题上有刷新、筛选、清除筛选、打开 `package.json`、查看输出日志的按钮

## 里程碑建议

1. 补 Extension Host 层面的集成测试
2. 打磨 monorepo 细节和 workspace 协议场景
3. 评估是否支持 `peerDependencies` / `optionalDependencies`
4. 打包并准备本地安装验证
5. 补 Marketplace 展示素材和发布流程

## 文档清单

- [产品需求文档](./docs/product-requirements.md)：你到底要做什么、MVP 到哪里为止、用户场景是什么
- [技术设计文档](./docs/technical-design.md)：用哪些 VS Code API、模块怎么拆、数据怎么流动
- [开发流程文档](./docs/development-workflow.md)：如何从零初始化项目、调试、验证和分阶段实现

## 你接下来最适合做的事

- 先按 `F5` 跑起来，确认筛选、升级、设置项都能在真实项目里工作
- 再读技术设计，理解为什么这版已经拆出了 `configuration`、`services`、`views`
- 然后挑一个方向继续深化：集成测试、发布准备，或者更多依赖类型支持
