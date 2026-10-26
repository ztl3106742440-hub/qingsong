# 清松发布记录

日期：2026-10-26。应用版本：0.1.1。

- 在线地址：https://ztl3106742440-hub.github.io/qingsong/
- GitHub 仓库：https://github.com/ztl3106742440-hub/qingsong
- 应用代码提交：`ff486619907e9640cfd03facbba633295b8193d9`
- 对应云端校验和部署：https://github.com/ztl3106742440-hub/qingsong/actions/runs/40337674904
- GitHub Pages 发布方式：GitHub Actions；HTTPS 已强制启用。

## 已完成的公网验证

1. GitHub Actions 的校验与部署全部成功，云端 `npm run check` 通过。
2. 使用 Windows Chromium 直接打开公开 HTTPS 地址完成 14 组浏览器交互与布局检查，包括 60 种纸张、字号、字距与横竖排边界组合。
3. 公网测试覆盖 768 × 1024、1180 × 820 平板视口和 360 × 800 窄屏，均无页面横向溢出，可见主要触控目标高度至少 44 CSS px。
4. 从公开页面生成 7 份实际 PDF，共 15 页；核对所有纸张尺寸、页数、每页正文及重复次数，并渲染首末页检查。最大字号的竖排样张包含 5 页，末句完整。
5. 逐个下载并核对 16 个公开资源的 SHA-256，包括全部代码、5 套基础字体、图标、授权文件和版本清单；与本地发布文件一致。
6. 部署标记 `.nojekyll` 在本地和仓库内检查；GitHub Pages 不对外提供该点文件，不作为 HTTP 资源校验对象。

本地另通过存储被禁止时的降级测试，因此本地完整浏览器检查为 15 组，公网为 14 组。

本机报告位于 `artifacts/qa/`：`browser-report.json`、`pdf-report.json`、`public-hashes.json`、`local-browser-report.json`、`local-pdf-report.json`。该目录被 Git 忽略。

## 范围与后续更新

- 仅发布 `public/` 网站资源。原始备份、QA 产物、个人方案和本机资料未公开。
- 代码或内容更新时，先修改 `src/`、`content/`，运行构建与检查，提交并推送 `main`；GitHub Actions 自动发布。
- 浏览器模拟与公网 PDF 导出验证已经完成，但没有把它们当成真实 Android / iPad 的系统打印验收。第一次在实际平板使用时，仍需核对系统打印和笔记软件导入效果。
- 当前版本没有 Service Worker，不宣称支持 PWA 安装或断网冷启动。

首次初始化期间，自动触发的部署早于 Pages 开关启用，配置步骤失败；启用 Pages 后的部署和 0.1.1 更新部署均成功。该初始化记录不影响当前站点。
