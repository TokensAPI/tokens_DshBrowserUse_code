/** 插件全部可调参数的唯一入口：改品牌、默认浏览器与运行方式只改本文件。 */

/* ====================================================================
 * 身份常量
 * package.json 与 cordis.patch.yml 无法执行 JS，须与本文件手工保持
 * 一致；test/plugin.test.js 会校验两者，失配即测试失败。
 * ==================================================================== */

/** 产品名：用于日志与用户可见文案。可被 config.productName 覆盖。 */
export const PRODUCT_NAME = 'TokensHarness'

/** npm 包名：须与 package.json 的 name 和 cordis.patch.yml 的 name 一致。 */
export const PACKAGE_NAME = '@tokens/dsh-browser-use'

/** Cordis 插件名：harness 日志与加载器中显示的名字。 */
export const PLUGIN_NAME = 'tokens-dsh-browser-use'

/** 模型工具的 MCP 命名空间：工具公开名为 mcp__<SERVER_NAME>__<原名>。 */
export const SERVER_NAME = 'browser'

/* ====================================================================
 * 浏览器默认值
 * 每项均为 Config 同名字段的默认值，用户可经 profile 补丁覆盖。
 * ==================================================================== */

/**
 * 浏览器渠道：chrome / msedge / chromium / firefox / webkit。
 * 默认 chrome 复用用户已装浏览器，安装包不携带 Chromium。
 * 可被 config.browser 覆盖。
 */
export const BROWSER = 'chrome'

/** 无头模式：默认 false——模型操作时弹出真实浏览器窗口，全程可见。可被 config.headless 覆盖。 */
export const HEADLESS = false

/** 隔离模式：默认 false 使用持久化 profile（保留登录态）；true 则每次会话全新环境。可被 config.isolated 覆盖。 */
export const ISOLATED = false

/**
 * 额外能力（逗号分隔）：默认全量开启——
 *   vision   坐标驱动的鼠标工具（截图 + 真实光标移动，Codex 同款交互形态）
 *   pdf      页面另存为 PDF
 *   devtools 控制台/网络等开发者工具
 * 快照与坐标两套操作工具同时注册，模型按任务自行选用；
 * 追求最小工具面时可经 config.caps 覆盖为 '' 只留快照模式。
 */
export const CAPS = 'vision,pdf,devtools'
