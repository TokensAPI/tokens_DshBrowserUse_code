/** TokensHarness 浏览器操作插件：经上游 MCP 客户端桥接 Playwright MCP。 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Schema from '@deepseek-ai/schemastery'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import { BROWSER, CAPS, HEADLESS, ISOLATED, PLUGIN_NAME, SERVER_NAME } from './identity.js'

/* ====================================================================
 * 插件标识与配置
 * 本插件是上游 dsh-mcp-client 的产品化封装：把用户友好的浏览器
 * 选项翻译成 @playwright/mcp 的启动参数，其余（连接、重连、工具
 * 注册与命名）全部复用上游实现，不自研任何浏览器操作代码。
 * ==================================================================== */

/** Stable Cordis plugin name. */
export const name = PLUGIN_NAME

/** 与上游 mcp-client 相同：工具经 ctx.tools 注册给模型。 */
export const inject = mcpClient.inject

/** Validated browser policy. */
// 每个字段的默认值集中定义在 identity.js，用户可经 profile 补丁按需覆盖。
export const Config = Schema.object({
  browser: Schema.union(['chrome', 'msedge', 'chromium', 'firefox', 'webkit']).default(BROWSER),
  headless: Schema.boolean().default(HEADLESS),
  isolated: Schema.boolean().default(ISOLATED),
  caps: Schema.string().default(CAPS),
  // 浏览器可执行文件绝对路径；留空按 browser 渠道自动发现。
  executablePath: Schema.string().default(''),
  // 首次导航失败即中止加载：默认 false 容忍慢启动，由上游按重连策略恢复。
  failOnStartupError: Schema.boolean().default(false),
})

/* ====================================================================
 * MCP server 启动参数（导出）
 * 纯函数：把插件 Config 翻译成 @playwright/mcp CLI 参数与 spawn
 * 形态。Windows 上 npx 是 .cmd 脚本，Node 的 spawn 拒绝直接执行，
 * 须经 ComSpec 包装；其余平台直接执行本包内解析出的 cli 入口。
 * ==================================================================== */

const require = createRequire(import.meta.url)

/**
 * Resolve the local @playwright/mcp CLI entry shipped with this plugin.
 * @returns {string} Absolute path of the MCP server entry script.
 */
export function resolveServerEntry() {
  return join(dirname(require.resolve('@playwright/mcp/package.json')), 'cli.js')
}

/**
 * Build the @playwright/mcp CLI arguments for one validated config.
 * @param {object} config Validated plugin config.
 * @returns {string[]} CLI arguments after the entry script.
 */
export function buildServerArgs(config) {
  const args = [`--browser=${config.browser}`]
  if (config.headless) args.push('--headless')
  if (config.isolated) args.push('--isolated')
  if (typeof config.caps === 'string' && config.caps.trim() !== '') {
    args.push(`--caps=${config.caps.trim()}`)
  }
  if (typeof config.executablePath === 'string' && config.executablePath.trim() !== '') {
    args.push(`--executable-path=${config.executablePath.trim()}`)
  }
  return args
}

/**
 * Build the upstream mcp-client config that launches the bundled server.
 * @param {object} config Validated plugin config.
 * @param {string} [platform] Node platform identifier; defaults to the current process.
 * @returns {object} Raw config for the upstream mcp-client plugin.
 */
export function buildClientConfig(config, platform = process.platform) {
  const entry = resolveServerEntry()
  const serverArgs = buildServerArgs(config)
  const node = process.execPath
  const spawnSpec = platform === 'win32'
    ? {
        command: process.env.ComSpec ?? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe'),
        args: ['/d', '/s', '/c', [node, entry, ...serverArgs].map(quoteCmdArgument).join(' ')],
      }
    : { command: node, args: [entry, ...serverArgs] }
  return {
    serverName: SERVER_NAME,
    transport: 'stdio',
    ...spawnSpec,
    failOnStartupError: config.failOnStartupError,
  }
}

function quoteCmdArgument(value) {
  if (/^[A-Za-z0-9:._\\/@=-]+$/u.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

/* ====================================================================
 * 插件主体
 * 委托上游 mcp-client 的 apply：连接管理、断线重连、工具同步与
 * mcp__browser__* 命名全部由上游负责，本插件只负责参数翻译。
 * ==================================================================== */

/**
 * Bridge the bundled Playwright MCP server into the model's tool registry.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context with the tool runtime.
 * @param {object} config Validated browser policy.
 */
export async function apply(ctx, config) {
  await mcpClient.apply(ctx, mcpClient.Config(buildClientConfig(config)))
}

/** 别名导出：便于文件级 URL 判断（fileURLToPath 供测试对齐路径分隔符）。 */
export const moduleDir = dirname(fileURLToPath(import.meta.url))
