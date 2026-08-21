import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { BROWSER, PACKAGE_NAME, PLUGIN_NAME, SERVER_NAME } from '../identity.js'
import { Config, buildClientConfig, buildServerArgs, name, resolveServerEntry } from '../index.js'

test('identity constants stay aligned with static manifests', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.equal(manifest.name, PACKAGE_NAME)
  assert.ok(patch.includes(`name: '${PACKAGE_NAME}'`))
  assert.equal(name, PLUGIN_NAME)
})

test('defaults keep a visible reusable browser', () => {
  const config = Config({})
  assert.equal(config.browser, BROWSER)
  assert.equal(config.headless, false)
  assert.equal(config.isolated, false)
  const args = buildServerArgs(config)
  assert.equal(args[0], '--browser=chrome')
  assert.equal(args[1], '--caps=vision,pdf,devtools')
  assert.match(args[2], /^--init-script=.*cursor-overlay\.js$/u)
  assert.equal(args.length, 3)
})

test('config toggles translate into CLI flags', () => {
  const args = buildServerArgs(Config({
    browser: 'msedge',
    headless: true,
    isolated: true,
    caps: 'vision,pdf',
    executablePath: 'C:\\Browsers\\chrome.exe',
    userDataDir: 'D:\\Profiles\\work',
    cursorOverlay: false,
  }))
  assert.deepEqual(args, [
    '--browser=msedge',
    '--headless',
    '--isolated',
    '--caps=vision,pdf',
    '--executable-path=C:\\Browsers\\chrome.exe',
    '--user-data-dir=D:\\Profiles\\work',
  ])
})

test('rejects unsupported browser channels', () => {
  assert.throws(() => Config({ browser: 'netscape' }))
})

test('server entry resolves to the bundled @playwright/mcp cli', () => {
  const entry = resolveServerEntry()
  assert.match(entry, /[\\/]@playwright[\\/]mcp[\\/]cli\.js$/u)
})

test('client config spawns the bundled cli with the node executable', () => {
  const client = buildClientConfig(Config({}))
  assert.equal(client.serverName, SERVER_NAME)
  assert.equal(client.transport, 'stdio')
  assert.equal(client.command, process.execPath)
  assert.match(client.args[0], /cli\.js$/u)
  // 参数保持独立数组元素传递，含逗号的 caps 不能经 shell 再解析。
  assert.ok(client.args.includes('--caps=vision,pdf,devtools'))
  assert.equal(client.env.ELECTRON_RUN_AS_NODE, '1')
})
