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
  assert.deepEqual(args, ['--browser=chrome'])
})

test('config toggles translate into CLI flags', () => {
  const args = buildServerArgs(Config({
    browser: 'msedge',
    headless: true,
    isolated: true,
    caps: 'vision,pdf',
    executablePath: 'C:\\Browsers\\chrome.exe',
  }))
  assert.deepEqual(args, [
    '--browser=msedge',
    '--headless',
    '--isolated',
    '--caps=vision,pdf',
    '--executable-path=C:\\Browsers\\chrome.exe',
  ])
})

test('rejects unsupported browser channels', () => {
  assert.throws(() => Config({ browser: 'netscape' }))
})

test('server entry resolves to the bundled @playwright/mcp cli', () => {
  const entry = resolveServerEntry()
  assert.match(entry, /[\\/]@playwright[\\/]mcp[\\/]cli\.js$/u)
})

test('client config wraps npx-free node spawn per platform', () => {
  const posix = buildClientConfig(Config({}), 'linux')
  assert.equal(posix.serverName, SERVER_NAME)
  assert.equal(posix.transport, 'stdio')
  assert.equal(posix.command, process.execPath)
  assert.match(posix.args[0], /cli\.js$/u)

  const windows = buildClientConfig(Config({}), 'win32')
  assert.match(windows.command, /cmd\.exe$/iu)
  assert.deepEqual(windows.args.slice(0, 3), ['/d', '/s', '/c'])
  assert.ok(windows.args[3].includes('cli.js'))
  assert.ok(windows.args[3].includes('--browser=chrome'))
})
