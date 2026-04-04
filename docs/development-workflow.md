# 开发流程文档

## 1. 文档目的

这份文档不是讲产品做什么，而是讲你应该按什么顺序把它做出来，以及在当前这个仓库里接下来应该怎么继续学。对于新手来说，最容易掉进的坑不是代码不会写，而是：

- 不知道先从哪里开始
- 不知道 VS Code 扩展怎么运行和调试
- 一上来就想把全部功能做完

所以这份文档给你两条线索：

- 从 0 到 1 的实现顺序
- 当前仓库已经走到哪一步

如果你想看“现在怎么测试、怎么打包、怎么做本地验证”，请配合阅读：

- [测试与验证文档](./testing-and-validation.md)

## 2. 建议的学习和实现原则

- 每次只解决一个明确问题
- 先跑通最小链路，再做增强
- 先用假数据搭 UI，再接真实数据
- 学习阶段可以先支持一个包管理器，再扩展其他管理器
- 每完成一小步都在 Extension Development Host 里验证

补充说明：当前这个仓库已经走过了“最小骨架”阶段，后面继续学习时，更适合用“功能对齐文档、补测试、做发布准备”的方式往下推进。

## 3. 环境准备

在开始之前，建议具备以下环境：

- Node.js LTS
- npm
- Git
- Visual Studio Code

如果你计划以后发布扩展，还会用到：

- `vsce`
- Visual Studio Marketplace 发布者账号

## 4. 初始化扩展项目

官方文档当前仍然推荐使用 Yeoman 和 `generator-code` 生成扩展骨架。你可以在空目录中运行：

```bash
npx --package yo --package generator-code -- yo code
```

建议的选择：

- Extension type：`New Extension (TypeScript)`
- Name：`Package Vision`
- Identifier：`package-vision`
- Initialize a git repository：`Yes`
- Bundle source code with webpack：`No`
- Package manager：`npm`

## 5. 初始化后你会看到什么

生成完成后，一般会得到这些内容：

- `package.json`
- `src/extension.ts`
- `tsconfig.json`
- `.vscode/launch.json`
- `.vscode/tasks.json`
- `README.md`

这里面最重要的是两个文件：

- `package.json`：扩展清单，决定扩展对 VS Code 贡献了什么
- `src/extension.ts`：扩展主入口，负责注册命令和视图

## 6. 推荐的实现顺序

### 6.1 阶段一：先理解最小扩展

目标：

- 能运行示例扩展
- 知道 `activate()` 在什么时候触发
- 知道 F5 会打开 Extension Development Host

### 6.2 阶段二：把入口放到 Activity Bar

目标：

- 学会在 `package.json` 中声明 `viewsContainers`
- 学会声明 `views`
- 左侧出现 `Package Vision` 图标

### 6.3 阶段三：用假数据渲染 Tree View

目标：

- 学会 `TreeDataProvider`
- 学会返回 Tree Item
- 学会刷新视图

### 6.4 阶段四：读取真实 `package.json`

目标：

- 学会读取工作区文件
- 学会解析依赖字段
- 用真实数据替换假数据

### 6.5 阶段五：查询最新版本

目标：

- 学会请求 npm registry
- 学会处理并发、超时、失败
- 学会把版本状态映射成 UI

### 6.6 阶段六：实现单包升级

目标：

- 学会注册命令
- 学会从 Tree Item 传参到命令
- 学会执行本地安装命令
- 学会执行后刷新界面

### 6.7 阶段七：补齐可用性

目标：

- 增加空状态
- 增加错误提示
- 增加包项操作入口
- 增加输出日志

### 6.8 阶段八：支持 monorepo 和多个 package.json

目标：

- 扫描工作区中的多个 `package.json`
- 在 Tree View 中按 package 分组
- 确保升级命令在正确目录执行

### 6.9 阶段九：补体验增强

目标：

- 增加设置项
- 增加快速筛选
- 增加彩色状态图标
- 增加基础测试

## 7. 日常调试方式

VS Code 扩展开发最常用的调试方式是：

1. 在项目中按 `F5`
2. 打开新的 Extension Development Host 窗口
3. 在新窗口中测试扩展
4. 返回源码窗口看断点和日志

建议你重点熟悉下面几个位置：

- Run and Debug 面板
- Debug Console
- Output 面板
- Command Palette

对于这个仓库，调试时尤其建议你反复验证三类场景：

- 单 package 项目
- monorepo / 多 package 项目
- 切换设置项或筛选条件后的视图变化

现在这个仓库也已经补上了 Extension Host 集成测试，所以你还可以：

- 执行 `npm run test:integration`
- 或者在 Run and Debug 里直接使用 `Run Package Vision Tests`
- 打包前执行 `npm run check:full`

如果修改的是视图声明，有时需要执行：

- `Developer: Reload Window`

## 8. 推荐的提交节奏

不要等功能很大了再提交。建议按下面节奏记录代码：

1. 初始化扩展骨架
2. Activity Bar 入口可见
3. Tree View 假数据可见
4. 真实 `package.json` 解析完成
5. 最新版本查询完成
6. 单包升级完成
7. monorepo / 多 `package.json` 支持完成
8. 设置项、筛选和测试完成
9. Extension Host 集成测试完成
10. 本地 VSIX 打包验证完成

这样回头复盘时，你会非常清楚自己是如何把一个插件做出来的。

## 9. 当前阶段可以先不做的东西

为了避免项目膨胀，下面这些建议继续延后：

- 自定义复杂 UI
- Webview
- 私有 npm registry 认证
- changelog 聚合
- 自动批量升级
- Marketplace 级别的细节优化

## 10. 本地验证清单

每完成一个阶段，至少检查这些点：

- 扩展能否正常激活
- Activity Bar 图标是否显示
- 视图是否能打开
- 没有 `package.json` 时是否有提示
- 有 `package.json` 时列表是否正确
- 刷新是否可用
- 筛选是否只显示目标状态
- 设置项是否真正影响升级后的版本写法
- 升级后是否真正修改了项目文件

## 11. 打包与分发

当功能稳定后，可以先在本地打包验证，而不是急着发布。

常见流程是：

```bash
npm install -g @vscode/vsce
vsce package
```

打包后会得到 `.vsix` 文件，你可以在 VS Code 中选择 “Install from VSIX” 进行本地安装测试。

## 12. 当前仓库已经走到哪一步

到目前为止，这个仓库已经完成了：

1. Activity Bar 入口和 Tree View
2. 最新版本查询与状态显示
3. 单包升级与输出日志
4. `npm` / `pnpm` / `yarn` / `bun` 支持
5. monorepo / 多 `package.json` 支持
6. 升级版本范围设置项
7. 快速筛选和状态图标优化
8. 纯逻辑单元测试

如果你接下来继续学习，最适合的顺序是：

1. 先按 `F5` 手工验证这些能力
2. 再读代码和测试，理解每层职责
3. 然后继续补更多集成测试，或者准备打包发布

## 13. 参考资料

- [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension)
- [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Activation Events](https://code.visualstudio.com/api/references/activation-events)
- [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
