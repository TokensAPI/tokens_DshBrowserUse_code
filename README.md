# @tokensapi/dsh-browser-use

TokensHarness 浏览器操作插件：让模型直接驱动一个**可见的真实浏览器**（导航、点击、填表、截图、读取页面结构）。

本插件不自研浏览器自动化——它是薄薄一层产品化封装：

- 浏览器操作由 [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)（Playwright 官方 MCP server，随本插件打包）提供，共 24 个工具；
- 接入桥由上游 `@deepseek-ai/dsh-mcp-client` 提供，工具以 `mcp__browser__*` 注册给模型；
- 本插件只做参数翻译（用户友好的 Config → CLI 参数）与跨平台 spawn（Windows 经 ComSpec 包装，不依赖 npx 与网络）。

## 默认行为

- **有头模式**：模型操作时弹出真实浏览器窗口，全程可见；
- **复用系统 Chrome**：不下载独立 Chromium，安装包零体积负担；
- **持久化 profile**：保留登录态，模型可以在你已登录的站点上工作。

## 配置

```yaml
- id: tokens-browser-use
  name: '@tokens/dsh-browser-use'
  config:
    browser: chrome        # chrome | msedge | chromium | firefox | webkit
    headless: false        # true 则后台运行不弹窗
    isolated: false        # true 则每次全新环境（不保留登录态）
    caps: ''               # 追加能力，如 "vision,pdf"
    executablePath: ''     # 浏览器可执行文件绝对路径，留空自动发现
```

所有默认值集中在 `identity.js`，用户可经 profile 补丁按需覆盖，改配置不需重启以外的操作（装/卸插件需重启）。

## 开发

```sh
npm install
npm run check   # 语法检查 + 全部单测
```

## 发布

推送 `v<版本号>` 标签即发布到私有源 `https://npm.tokensapi.ai/`，只有这一个入口；分支和 PR 只跑 `checks.yml`。
发布工作流自带同一套 Node 22.19 / 24 检查矩阵（`needs:` 不能跨工作流，所以不是重复，不要删），通过后校验标签、版本、仓库和 Registry 身份，只在确认版本未发布（仅 E404）时发布同一份 tarball，不覆盖已有版本。

需要的仓库 Secret：

- `VERDACCIO_PUBLISH_TOKEN`：发布账号 `tokenscowork`，只交给发布步骤；缺失时发布前失败。
- `PLUGIN_CHECK_REGISTRY_TOKEN`：`market` 只读账号，用于发布后的统一包检查；未配置时警告并跳过检查，不阻断发布。

失败后在 Actions 页面重跑原运行，不要为让重试通过而改版本号。
