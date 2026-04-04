# Marketplace 发布文档

这份文档用于整理 `Package Vision` 在 VS Code Marketplace 首次发布前后的关键信息。

如果你准备开始真正发布，建议优先看这份更偏执行清单的文档：

- [Marketplace 发布前最后清单](./marketplace-release-checklist.md)

## 当前已就绪内容

- 已配置 `publisher`、`repository`、`homepage`、`bugs`、`license`
- 已补充 Marketplace 用的 `icon`、`galleryBanner`、`categories`、`keywords`
- 已有面向用户的 `README.md`
- 已新增 `CHANGELOG.md`
- 已完成本地 `vsce package` 打包验证
- 已完成本地 VSIX 安装验证

## 当前的 Marketplace 元数据

- 扩展名：`Package Vision`
- 扩展 ID：`zongpengz.package-vision`
- 当前版本：`0.0.1`
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

## 首次发布前建议再检查的事项

- 截图或录屏是否已经准备好
- README 首页是否足够像插件介绍页，而不是仓库维护说明
- 是否要把首个公开版本标记为 `preview`
- 发布版本号是否仍然保持 `0.0.1`
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
   - `npm run check:full`
   - `vsce package`
6. 正式发布
   - `vsce publish`

## 可选的手动发布方式

如果你不想直接在命令行发布，也可以先执行：

- `vsce package`

然后把生成的 `.vsix` 上传到 Marketplace 的 publisher 管理页面。

## 这份文档对应的官方资料

- Publishing Extensions
  - https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Extension Manifest
  - https://code.visualstudio.com/api/references/extension-manifest
