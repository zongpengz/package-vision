# 测试与验证文档

## 1. 目的

这份文档专门说明这个仓库现在怎么测试、怎么做本地验证，以及在发布前应该跑哪些命令。

它和 `README.md` 的分工不同：

- `README.md` 面向插件使用者和仓库访客
- 这份文档面向维护者和开发者

## 2. 当前测试分层

当前仓库有两层测试：

### 2.1 单元测试

特点：

- 跑纯逻辑模块
- 执行快
- 适合日常开发时频繁回归

当前重点覆盖：

- 版本状态判断，例如 `upToDate` / `outdated` / `unknown`
- 大版本升级策略和安全目标推导
- 批量保守升级候选集选择逻辑
- package manifest 的组装和依赖展开
- monorepo 版本分裂分析
- monorepo 场景下各个包管理器的升级命令构造
- 升级后的版本范围写回策略
- 依赖状态快速筛选、package scope 和搜索组合逻辑

运行命令：

```bash
npm run test:unit
```

### 2.2 Extension Host 集成测试

特点：

- 真的启动一份用于测试的 VS Code
- 在 Extension Development Host 环境里运行
- 验证扩展主链路是否按预期工作

当前重点覆盖：

- 扩展命令是否注册成功
- 多个 `package.json` 的工作区扫描
- Tree View 在 monorepo 下的分组渲染
- package scope、快速筛选和搜索在真实 Extension Host 中的结果
- 版本分裂提示是否在 fixture 工作区里正常出现
- 当前可见依赖能否产出批量保守升级候选集
- 批量保守升级是否严格遵守当前 package scope

运行命令：

```bash
npm run test:integration
```

调试方式：

- 在 VS Code 的 Run and Debug 面板里使用 `Run Package Vision Tests`

## 3. 常用验证命令

### 3.1 类型检查

```bash
npm run typecheck
```

这会执行：

- `npm run typecheck:src`
- `npm run typecheck:tests`

适合在你只想快速确认 TypeScript 类型是否干净时使用。

### 3.2 ESLint 检查

```bash
npm run lint
```

需要自动修复明显的格式和导入问题时，可以执行：

```bash
npm run lint:fix
```

### 3.3 日常开发检查

```bash
npm run check
```

这会执行：

- `npm run lint`
- `npm run typecheck`
- `npm run compile`
- `npm run test:unit`

### 3.4 完整检查

```bash
npm run check:full
```

这会执行：

- `npm run check`
- `npm run test:integration`

如果你准备提交较大的功能改动，建议至少跑一次这个命令。

## 4. 本地打包验证

当前仓库已经接入了本地 VSIX 打包验证。

运行命令：

```bash
npx @vscode/vsce package
```

打包结果会生成到项目根目录，例如：

```text
package-vision-0.2.0.vsix
```

目前仓库也已经补齐了这些打包前必要内容：

- `LICENSE`
- `.vscodeignore`
- `package.json` 里的 `repository` / `homepage` / `bugs`

## 5. 本地安装 VSIX 验证

打包完成后，可以继续做一次手工安装验证：

1. 在 VS Code 里打开命令面板
2. 执行 `Extensions: Install from VSIX...`
3. 选择打包出来的 `.vsix`
4. 重新加载窗口并手工验证侧边栏功能

## 6. 当前 fixture 与测试资源

集成测试当前使用一套 monorepo fixture：

- `src/test/fixtures/monorepo/package.json`
- `src/test/fixtures/monorepo/packages/web/package.json`
- `src/test/fixtures/monorepo/packages/api/package.json`

这样做的目的是让多 package 扫描、分组渲染和筛选行为有稳定的验证基线。

当前这套 fixture 也包含一个最小的版本分裂场景：

- 根 package 和 `packages/api` 同时声明了 `shared-lib`
- 但声明版本不同

## 7. 什么时候该补新测试

建议在这些场景补测试：

- 新增新的筛选模式
- 新增新的 package scope 或范围过滤规则
- 新增新的搜索或组合筛选规则
- 新增新的依赖类型，例如 `peerDependencies`
- 新增新的跨 package 分析能力
- 调整包管理器命令构造逻辑
- 修改版本范围写回策略
- 修改 Tree View 的层级结构或空状态行为

## 8. 当前仍未覆盖的部分

虽然当前测试链路已经比较完整，但仍然有一些内容主要依赖手工验证：

- 真正调用包管理器完成在线升级
- 不同操作系统下的命令执行差异
- Marketplace 安装后的真实体验
- 复杂 monorepo / workspace 协议场景
