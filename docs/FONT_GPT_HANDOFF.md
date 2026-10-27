# 清松字体扩展：网页版 GPT 交接要求

适用日期：2026-10-27。此文用于收集字体资源，交由 Codex 核验并集成，不是网页内直接导入的项目 JSON。

## 工作分工

网页版 GPT 负责寻找、筛选字体，整理来源和授权证据；能下载时交付真实字体文件。Codex 负责检查二进制、覆盖字符、授权文件、浏览器效果及 PDF 嵌入，并维护应用格式。

所有外部交付从 `draft + unverified` 开始。链接存在、JSON 合法或文件能打开，不等于字体覆盖完整、允许公开分发或 PDF 已通过检查。

## 可直接复制给网页版 GPT 的提示词

```text
我正在开发《清松》，一款在平板 Chrome 使用的诗文全文临摹字帖工具。
工作流：选字体 → 输入整篇诗文/英文 → 排版 → 在浏览器内直接生成 PDF → 导入笔记软件描红。
产品为 GitHub Pages 静态网站；字体需要能合法随网站提供，并能嵌入生成的 PDF。

请为我筛选第一批字体：
1. 中文 3～5 套，优先现代硬笔楷书、自然行楷、清楚易认的日常手写。全文临摹可读性优先，避免主要是毛笔字、装饰字或夸张签名体。
2. 英文 2～3 套，优先清楚的考试/日常手写和适度连笔，不只挑标题装饰字体。
3. 每套必须有官方项目、作者网站或可信原始发布来源；优先开放许可、可随静态网站分发并支持 PDF 嵌入的字体。
4. 不要把“免费下载”“个人使用免费”或网页能显示，自动解释为允许把字体文件放进公开 GitHub 仓库。
5. 不要重复打包同一个字体文件再改显示名称，或用简单倾斜、拉伸冒充新的字体。
6. 若无法核实下载链接、许可、版本或覆盖范围，请写 unknown/null，并说明缺什么证据；不要编造。

交付格式：
A. 一个 UTF-8 的 manifest.json，仅输出合法 JSON，无注释、无尾逗号。
B. 如当前环境能下载文件，另给 ZIP：manifest.json、fonts/ 下的真实字体、licenses/ 下的原始授权文本。不能下载就如实说明，提供可靠来源，不要声称已打包。
C. 字体使用 TTF / OTF / WOFF / WOFF2。优先保留原始版本；不要无理由转换或改字体内部名称。
D. 不要用字体截图、几张字图、SVG 单字、CSS 字体名或长篇 Base64 代替完整字体文件。
E. 本次不修改我的 HTML，不修改既有字体，不另造一套应用。

manifest.json 的顶层字段必须为：
{
  "handoffSchemaVersion": "qingsong-fonts-1",
  "batchId": "用小写英文字母、数字和连字符填写唯一批次名",
  "fonts": [],
  "omissions": []
}

fonts 数组每项必须包含以下字段，不额外添加代码：
- id：小写英文/数字/连字符，稳定且唯一。
- name：原始字体名称；displayName：拟在清松显示的中文名称。
- language：zh 或 en。
- style：regular / running / cursive / print / decorative 之一。
- author：作者或项目名称，未知填 null。
- sourceUrl：官方项目或原始发布页面的完整 HTTPS URL，未知填 null。
- release：实际版本/发布标签，未知填 null。
- format：ttf / otf / woff / woff2，未知填 null。
- fontFile：ZIP 内相对路径，例如 fonts/字体文件名.woff2；未交付文件则填 null。
- downloadUrl：实际字体文件的完整 HTTPS 下载 URL，未知填 null。不要用搜索结果页代替文件地址。
- license：对象，包含 spdx、sourceUrl、licenseFile、webRedistribution、pdfEmbedding、evidence。
  spdx 是原始授权标识，未知填 null；sourceUrl 是原始授权页面 URL，未知填 null；licenseFile 是 ZIP 内的原始授权路径，未交付填 null。
  webRedistribution 与 pdfEmbedding 只能填 allowed / not_allowed / unknown；没有明确证据时填 unknown。
  evidence 用简短中文说明所依据的原始条款及适用条件，不臆测授权。
- coverage：对象，包含 description、tested、missingCharacters。
  description 如实描述已知字符覆盖；没有实际读取/测试字体时 tested 必须为 false，missingCharacters 填 null，不能写“全字库已验证”。
- sampleText：中文字体使用“清风徐来，水波不兴。春江花月夜，梦游天姥吟留别。”；英文字体使用“The quick brown fox jumps over the lazy dog. ABC xyz 0123456789,.;:!?”。
- notes：全文可读性、风格区别、已知缺字或限制。
- publicationStatus：固定 draft。
- verificationStatus：固定 unverified。

omissions 每项包含 requested（未能完成的需求）和 reason（原因）。不满足要求的字体不要伪装成可用资源。

如果你推荐的是原创字体开发，请另行说明已实际制作的字符集合与真实字体文件，不得把几张手写效果图宣称为支持任意汉字的完整字体。
```

## 交付后的接收检查

1. 核对原始来源、版本和授权证据；仅限个人使用、禁止再分发或授权不明的文件不自动上传公开仓库。
2. 核对字体文件头、格式、体积、SHA-256、内部名称和字符映射；不执行包内脚本。
3. 用完整《春江花月夜》《梦游天姥吟留别》、标题、作者和英文样本文字实际检测缺字。
4. 在平板视口检查卡片、横排、竖排、长文、字距与分页，再检查内置 PDF 导出的实际文件。
5. 校验通过后由 Codex 将字段映射到 `content/library.js`，把字体和原始许可放入站点目录，构建、检查后再发布。此 manifest 不直接替换当前项目 JSON。

## 如果还要扩展诗文内容

字体资源和作品内容请分批交付。作品包建议为 UTF-8 JSON，包含 `handoffSchemaVersion: "qingsong-works-1"` 和 `works` 数组；每项使用 `id`、`label`、`lang`（zh/en）、`title`、`author`、`mode`（poem/vertical/prose/quotes/essay）、`text`、`sourceUrls`、`rights`（public-domain/original/permission/unknown）、`publicationStatus: "draft"`、`verificationStatus: "unverified"`。

`text` 保存完整原文，以 `\n` 保留换行，不用 HTML 或 Markdown 代替正文；区分原作、异文和原创文本，不能把原创英文标成真实考试原文。Codex 核验后再接入现有模板格式。
