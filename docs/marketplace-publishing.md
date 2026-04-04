# Marketplace 发布文档

这份文档用于整理 `Package Vision` 在 VS Code Marketplace 发布前后的关键信息。

如果你准备开始真正发布，建议优先看这份更偏执行清单的文档：

- [Marketplace 发布前最后清单](./marketplace-release-checklist.md)

## 当前发布状态

- 最新发布版本：`0.1.0`
- 发布时间：`2026-04-04`
- 扩展 ID：`zongpengz.package-vision`
- Marketplace 页面：
  - https://marketplace.visualstudio.com/items?itemName=zongpengz.package-vision
- Publisher 管理页：
  - https://marketplace.visualstudio.com/manage/publishers/zongpengz/extensions/package-vision/hub

我在本地用 `vsce show zongpengz.package-vision` 做过发布后核对，CLI 已经能读取到这条扩展记录。

## 当前已就绪内容

- 已配置 `publisher`、`repository`、`homepage`、`bugs`、`license`
- 已补充 Marketplace 用的 `icon`、`galleryBanner`、`categories`、`keywords`
- 已有面向用户的 `README.md`
- 已准备 Marketplace 截图资源
  - `docs/images/marketplace/overview.png`
  - `docs/images/marketplace/filter-outdated.png`
  - `docs/images/marketplace/upgrade-single-package.png`
- 已新增 `CHANGELOG.md`
- 已完成本地 `vsce package` 打包验证
- 已完成本地 VSIX 安装验证

## 当前的 Marketplace 元数据

- 扩展名：`Package Vision`
- 扩展 ID：`zongpengz.package-vision`
- 当前版本：`0.1.0`
- 短描述：
  - `Inspect dependency versions, filter outdated packages, and upgrade them from the VS Code sidebar.`
- 分类：
  - `Other`
  - `Visualization`
- 关键词：
  - `package.json`
  - `dependency`
  - `dependencies`
  - `outdated`
  - `npm`
  - `pnpm`
  - `yarn`
  - `bun`
  - `monorepo`
  - `versions`
  - `upgrades`

## 发布后仍值得优化的事项

- 截图在 Marketplace 页面里的展示顺序是否满意
- README 首页是否足够像插件介绍页，而不是仓库维护说明
- 下一次发布是继续走 `patch` 还是提升到 `0.2.0`
- `CHANGELOG.md` 是否和这次发布内容一致

## 发布流程

1. 安装或更新 `vsce`
   - `npm install -g @vscode/vsce`
2. 准备 Azure DevOps Personal Access Token
   - Scope 至少包含 Marketplace 的 `Manage`
3. 如果还没有 publisher，在 Marketplace 管理页创建 publisher
4. 运行登录命令
   - `vsce login zongpengz`
5. 本地再次验证
   - `npm run check`
   - `npx @vscode/vsce package`
6. 正式发布
   - `vsce publish`

## 当前更稳的发布门槛

目前建议把下面 4 项作为正式发布前的硬门槛：

1. `npm run check`
2. `npm run check:full`
3. `npx @vscode/vsce package`
4. 本机安装生成的 `.vsix`，手动检查截图中展示的核心流程

## 当前展示面的简短复盘

- 短描述已经能清楚表达“查看依赖版本 + 筛选过时依赖 + 直接升级”
- 关键词覆盖了 `npm`、`pnpm`、`yarn`、`bun`、`monorepo`，基础发现性已经够用
- README 已经有 3 张截图，能解释主列表、筛选和单包升级
- 如果后面你想继续优化商店转化，最值得优先尝试的是：
  - 把 README 开头再压缩成更像产品卖点的 2 到 3 句话
  - 考虑补一段英文简介，提升更广泛搜索下的理解成本
  - 等有更多数据后，再决定是否调整关键词或分类

## 可选的手动发布方式

如果你不想直接在命令行发布，也可以先执行：

- `vsce package`

然后把生成的 `.vsix` 上传到 Marketplace 的 publisher 管理页面。

## 这份文档对应的官方资料

- Publishing Extensions
  - https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Extension Manifest
  - https://code.visualstudio.com/api/references/extension-manifest
