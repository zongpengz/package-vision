# 开发流程文档

## 1. 文档目的

这份文档不是讲产品做什么，而是讲你应该按什么顺序把它做出来。对于新手来说，最容易掉进的坑不是代码不会写，而是：

- 不知道先从哪里开始
- 不知道 VS Code 扩展怎么运行和调试
- 一上来就想把全部功能做完

所以这份文档给你一个“从 0 到 1”的实施路径。

## 2. 建议的学习和实现原则

- 每次只解决一个明确问题
- 先跑通最小链路，再做增强
- 先用假数据搭 UI，再接真实数据
- 先支持一个包管理器，再扩展其他管理器
- 每完成一小步都在 Extension Development Host 里验证

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

官方文档当前仍然推荐使用 Yeoman 和 `generator-code` 生成扩展骨架。你可以在当前目录中运行：

```bash
npx --package yo --package generator-code -- yo code
```

提示：生成器的具体提问可能会随着 `generator-code` 版本变化，但大的方向不变，优先保证是 TypeScript、桌面扩展、最小可运行骨架。

建议的选择：

- Extension type：`New Extension (TypeScript)`
- Name：`Package Vision`
- Identifier：`package-vision`
- Description：填写一句清晰说明
- Initialize a git repository：`Yes`
- Bundle source code with webpack：`No`，第一版先降低复杂度
- Package manager：`npm`

如果你更想要干净一点的现代构建，也可以在后续自行切换到 `esbuild` 或 `webpack`，但不建议在第一天同时处理太多变量。

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

## 6. 你应该按什么顺序开发

### 6.1 阶段一：先理解最小扩展

目标：

- 能运行示例扩展
- 知道 `activate()` 在什么时候触发
- 知道 F5 会打开 Extension Development Host

验证方式：

- 按 F5
- 在新窗口执行示例命令
- 看到提示消息

### 6.2 阶段二：把入口放到 Activity Bar

目标：

- 学会在 `package.json` 中声明 `viewsContainers`
- 学会声明 `views`
- 左侧出现 `Package Vision` 图标

这一步先不用接真实数据，看到入口出现就算成功。

### 6.3 阶段三：用假数据渲染 Tree View

目标：

- 学会 `TreeDataProvider`
- 学会返回 Tree Item
- 学会刷新视图

建议先写死几条数据，例如：

- `react` -> `^18.2.0` / `19.0.0`
- `vite` -> `^5.4.0` / `6.0.0`

这样你可以先专心理解视图 API。

### 6.4 阶段四：读取真实 `package.json`

目标：

- 学会读取工作区文件
- 学会解析依赖字段
- 用真实数据替换假数据

完成后，你的扩展虽然还不会查“最新版本”，但已经能成为一个依赖浏览器。

### 6.5 阶段五：查询最新版本

目标：

- 学会请求 npm registry
- 学会处理并发、超时、失败
- 学会把版本状态映射成 UI

完成后，扩展就开始真正接近 `npm outdated` 的价值了。

### 6.6 阶段六：实现单包升级

目标：

- 学会注册命令
- 学会从 Tree Item 传参到命令
- 学会执行本地安装命令
- 学会执行后刷新界面

建议第一版只做一个动作：

- 升级到最新版本

不要在这一阶段同时做：

- 升级到指定版本
- 升级全部
- 自动区分所有包管理器

### 6.7 阶段七：补齐可用性

目标：

- 增加空状态
- 增加错误提示
- 增加右键菜单
- 增加设置项
- 增加基础测试

## 7. 日常调试方式

VS Code 扩展开发最常用的调试方式是：

1. 在项目中按 F5
2. 打开新的 Extension Development Host 窗口
3. 在新窗口中测试扩展
4. 返回源码窗口看断点和日志

建议你重点熟悉下面几个位置：

- Run and Debug 面板
- Debug Console
- Output 面板
- Command Palette

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
7. 错误处理和测试完成

这样回头复盘时，你会非常清楚自己是如何把一个插件做出来的。

## 9. 第一版可以先不做的东西

为了避免新手项目膨胀，下面这些建议刻意延后：

- 自定义复杂 UI
- Webview
- 多工作区和 monorepo
- 私有 npm registry 认证
- changelog 聚合
- 自动批量升级

## 10. 本地验证清单

每完成一个阶段，至少检查这些点：

- 扩展能否正常激活
- Activity Bar 图标是否显示
- 视图是否能打开
- 没有 `package.json` 时是否有提示
- 有 `package.json` 时列表是否正确
- 刷新是否可用
- 升级后是否真正修改了项目文件

## 11. 打包与分发

当第一版功能稳定后，可以先在本地打包验证，而不是急着发布。

常见流程是：

```bash
npm install -g @vscode/vsce
vsce package
```

打包后会得到 `.vsix` 文件，你可以在 VS Code 中选择 “Install from VSIX” 进行本地安装测试。

这一步适合放在功能完整之后，再做会更省心。

## 12. 你现在最值得执行的下一步

如果你准备开始写代码，最好的顺序是：

1. 用生成器初始化 TypeScript 扩展
2. 先把 Activity Bar 入口做出来
3. 用假数据把 Tree View 渲染出来

只要这三步完成，你就已经从“想做一个插件”进入“手上已经有一个可运行的插件骨架”了。接下来接真实数据会顺畅很多。

## 13. 参考资料

- [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension)
- [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Activation Events](https://code.visualstudio.com/api/references/activation-events)
- [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
