# Marketplace 发布前最后清单

这份文档面向真正准备点击发布的那一天，尽量把最后要确认的事项收成一张短清单。

> `0.1.0` 已于 `2026-04-04` 成功发布。这个清单可以继续作为下一个版本发布前的复用模板。

## 当前结论

截至 2026 年 4 月 4 日，`Package Vision` 的 `0.1.0` 发布已经完成：

- 已发布版本：`0.1.0`
- 已发布到：https://marketplace.visualstudio.com/items?itemName=zongpengz.package-vision
- 已有完整的扩展元数据
- 已有 Marketplace 图标
- 已有面向用户的 `README.md`
- 已有 `CHANGELOG.md`
- 已完成本地 `vsce package`
- 已完成本地 VSIX 安装验证

下一次发布前仍然建议重点确认这 3 个非代码项：

- 是否需要以 `preview` 身份发布特殊版本
- 最终版本号是 `0.1.1`、`0.2.0` 还是更高
- Marketplace 页面里截图的展示顺序是否满意

## 已完成的发布准备

- [x] `publisher` 已配置为 `zongpengz`
- [x] `repository`、`homepage`、`bugs`、`license` 已配置
- [x] `description`、`categories`、`keywords` 已补齐
- [x] Marketplace 图标已配置为 PNG
- [x] Marketplace 截图已准备
  - `docs/images/marketplace/overview.png`
  - `docs/images/marketplace/filter-outdated.png`
  - `docs/images/marketplace/upgrade-single-package.png`
- [x] `galleryBanner` 已配置
- [x] `README.md` 已收敛为用户导向
- [x] `CHANGELOG.md` 已创建
- [x] 本地打包已通过
- [x] 本地安装 VSIX 已验证

## 下次发布前必须确认

- [x] 已准备主视图截图
- [x] 已准备筛选视图截图
- [x] 已准备单包升级截图
- [ ] 决定这次是否需要设置 `preview: true`
- [ ] 确认本次版本号是 `0.1.1`、`0.2.0` 还是其他版本
- [ ] 再通读一次 `README.md` 的开头 2 屏，确保像插件介绍页
- [ ] 再通读一次 `CHANGELOG.md`，确认它和这次准备发布的功能一致
- [ ] 确认 README 里的截图顺序和实际想突出展示的卖点一致

## 发布前建议执行的验证

建议把下面 3 项作为当前仓库更稳的发布门槛：

1. `npm run check`
2. `npx @vscode/vsce package`
3. 在本机安装生成的 `.vsix`，手动检查侧边栏入口、列表展示、筛选、单包升级入口

## 当前已知事项

- `npm run check:full` 暂时不建议作为本次发布前的硬门槛
- 原因是当前的 Extension Host 集成测试 runner 在本机上还有单独的 CLI 启动问题，需要后续单独排查
- 这不影响当前的 Marketplace 元数据、打包和 VSIX 安装链路

## 下次发布当天命令清单

1. 先做本地验证
   - `npm run check`
   - `npx @vscode/vsce package`
2. 如果还没登录 publisher
   - `vsce login zongpengz`
3. 正式发布
   - `vsce publish`

如果你想在发布时顺手改版本号，也可以使用：

- `vsce publish patch`
- `vsce publish minor`
- `vsce publish 0.2.0`

## 发布后 10 分钟内建议回看

- Marketplace 页面是否正确显示图标、README 和 changelog
- 搜索结果里名称和短描述是否足够清晰
- VS Code 扩展页里安装按钮是否正常
- 资源链接是否都指向 GitHub 正确页面

## 你可以直接照着做的最短路径

1. 准备截图
2. 决定是否 `preview`
3. 决定版本号
4. 跑 `npm run check`
5. 跑 `npx @vscode/vsce package`
6. 本地安装一次 VSIX
7. 执行 `vsce login zongpengz`
8. 执行 `vsce publish`
