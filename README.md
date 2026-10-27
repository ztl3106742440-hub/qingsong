# 清松

清松是一款面向平板使用的诗文临摹字帖制作工具。从 INKFLOW 04.3 独立 HTML 整理而来，支持整篇浅灰范字、中英文字体、自动分页和内置 PDF 直接下载。当前版本 0.2.0。

在线地址：https://ztl3106742440-hub.github.io/qingsong/

## 使用

1. 用平板或电脑浏览器打开网站。
2. 选择中文或英文、基础字体或自有字体，选择预置作品或粘贴自己的文字。
3. 调整纸张、排版、描红深浅和重复方式；平板竖屏通过顶部“字体与排版 / 整页预览”切换。
4. 点击“下载 PDF”，直接生成只包含字帖纸张的 PDF；若系统未自动保存，可点击生成后显示的下载链接。
5. 将 PDF 导入平板笔记软件，用触控笔临摹。

内置导出不需要选择系统打印机或设置边距。可见字形使用矢量轮廓，另保留可检索文字层，放大仍清晰，不将整个网页截图。预览与导出共用分页结果和纸张毫米尺寸。基础字体和重新导入的本地字体可直接导出；联网字体还需成功读取字体文件，失败会明确提示。

设置区底部保留“备用：浏览器打印”。只有使用该备用入口时，才需要选择对应纸张、缩放 100%、边距无并关闭页眉页脚。

## 数据与字体

- 网站不使用账号、后端或云同步。输入的正文、导入的 JSON 和字体在浏览器内处理，不上传 GitHub。
- “保存设置”只保存到当前浏览器；跨设备转移用“导出项目 / 导入项目”。保留 INKFLOW 4.3 JSON 兼容，以及旧 `version: 4` 的基本文字迁移。
- 本地字体只在当前页面会话有效，不随 JSON 保存；刷新、换设备后需重新导入。
- 5 套基础字体作为网站资源提供。联网字体只有主动点击时才请求 Google Fonts；失败会提示并保留原字体。
- 原始字体授权完整保留于 `public/licenses/FONT-NOTICES.txt`，Arphic 许可另存为 `ARPHICPL.TXT`。字体不是项目新创作的全字库。
- 本版尚未加入 Service Worker / PWA 安装和离线缓存。已打开页面可在资源加载完毕后继续排版，但不能据此保证断网冷启动。
- 原始便携 HTML 保留在维护电脑的 `references/`，不进入公开仓库。

## 开发与目录

需要 Node.js 22 或更新版本。PDF 导出使用站内固定版本的 `pdf-lib` 与 `@pdf-lib/fontkit` 浏览器包，首次点击下载时加载；无需额外后端、账号或模型接口。

```text
src/                  页面、交互、分页和样式源文件
content/library.js    预置诗文和字体卡片元数据
public/               网站发布目录
  assets/             由构建生成的代码与样式
  fonts/              从原始 HTML 原样提取的 WOFF2
  licenses/           原始完整字体授权
  vendor/             固定版本 PDF 引擎、字体解析库及授权
  version.json        发布资源 SHA-256 清单
tools/                构建、本地服务、浏览器与 PDF 验证
tests/                数据、迁移与分页回归测试
docs/                 来源、发布与验证记录
references/           原始交付文件的本机备份，Git 忽略
artifacts/qa/         本机验证结果、截图和 PDF，Git 忽略
```

修改 `src/`、`content/` 后重新构建，不直接修改生成的 `public/assets/`。

```sh
node tools/build.mjs
node tools/serve.mjs
```

预览地址为 `http://127.0.0.1:4174/qingsong/`。本地服务仅监听当前电脑，正式发布后访问网站不需要电脑保持开机。

```sh
npm run check
npm run qa
```

`check` 运行 Node 原生测试并核对构建产物、字体与 PDF 库哈希、授权和资源路径。浏览器验证包含实际按钮下载 PDF 和原生触摸事件。需要 Playwright 和 Chromium：在普通开发环境可运行 `npm install --no-save --package-lock=false playwright` 与 `npx playwright install chromium`；也支持通过 `PLAYWRIGHT_MODULE`、`CHROME_PATH` 指定现有安装。Codex 环境自动使用其随附 Playwright 和本机 Chrome。

PDF 检查使用 `tools/verify-pdfs.py`，需要 Python 的 `pypdf`、`pypdfium2`、`Pillow`。验证时检查实际 PDF 页数、毫米尺寸、每页正文及末句，并渲染首末页作视觉检查。

## 发布

仓库 `main` 分支更新后，GitHub Actions 先执行 `npm run check`，通过后仅发布 `public/` 到 GitHub Pages。个人方案、浏览器资料、原始备份和本机测试产物不会作为网站内容发布。

GitHub Pages 设置应为 GitHub Actions。部署流程位于 `.github/workflows/deploy.yml`。

本次修复与验证见 `docs/RELEASE_0.2.0.md`。桌面 Chromium 的原生触摸与屏幕模拟仍不能代替真实华为平板的最终操作确认。

字体扩展交接要求及可直接复制给网页版 GPT 的提示词见 `docs/FONT_GPT_HANDOFF.md`。字体资源必须提供真实字体文件或可靠下载来源、原始授权和覆盖情况，不能用效果图或字体名清单代替可加载的字库。
