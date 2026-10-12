import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { EXPECTED_REGISTRY, EXPECTED_REPOSITORY, validateRelease } from '../scripts/validate-release.mjs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = (name) => parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'));

test('release identity accepts only the current stable tag, this repository and the private registry', () => {
  // Derived from package.json so a version bump never fails this test on the way to a release.
  assert.deepEqual(validateRelease(`v${manifest.version}`, manifest), []);
  assert.equal(manifest.publishConfig.registry, EXPECTED_REGISTRY);
  for (const [tag, change] of [
    [`v${manifest.version}.1`, {}],
    [manifest.version, {}],
    [`v${manifest.version}-beta.1`, { version: `${manifest.version}-beta.1` }],
    [`v${manifest.version}`, { repository: { type: 'git', url: 'git+https://github.com/someone/fork.git' } }],
    [`v${manifest.version}`, { repository: { type: 'git', url: `git+https://github.com/${EXPECTED_REPOSITORY}-copy.git` } }],
    [`v${manifest.version}`, { publishConfig: { registry: 'https://registry.npmjs.org/' } }],
  ]) assert.notDeepEqual(validateRelease(tag, { ...manifest, ...change }), [], `${tag} ${JSON.stringify(change)}`);
});

test('branch checks and tag releases are disjoint and gate on the same matrix', () => {
  const checks = workflow('checks.yml');
  const release = workflow('publish-npm.yml');
  assert.deepEqual(checks.on, { push: { branches: ['**'] }, pull_request: null });
  assert.deepEqual(release.on, { push: { tags: ['v*'] } });
  assert.deepEqual(release.jobs.check.strategy.matrix, checks.jobs.check.strategy.matrix);
  for (const w of [checks, release]) {
    assert.deepEqual(w.permissions, { contents: 'read' });
    assert.equal(w.concurrency.group, '${{ github.workflow }}-${{ github.ref }}');
  }
  assert.equal(checks.concurrency['cancel-in-progress'], true);
  assert.equal(release.concurrency['cancel-in-progress'], false);
  assert.equal(release.jobs.publish.needs, 'check');
  assert.equal(release.jobs.publish.if, "startsWith(github.ref, 'refs/tags/v')");
  const packageCheck = release.jobs['package-check'];
  assert.equal(packageCheck.needs, 'publish');
  assert.equal(packageCheck.if, "needs.publish.outputs.package-check == 'true'");
  assert.equal(release.jobs.publish.outputs['package-check'], '${{ steps.checker.outputs.enabled }}');
  const checker = packageCheck.uses.match(/^TokensAPI\/tokens_DshPluginCheck_code\/\.github\/workflows\/check-plugin-package\.yml@([a-f0-9]{40})$/u);
  assert.ok(checker, 'package check must call the shared workflow at a pinned commit');
  assert.deepEqual(packageCheck.with, { package: '${{ needs.publish.outputs.package }}', checker_ref: checker[1] });
  const refuseFork = release.jobs.publish.steps.find((s) => s.name === 'Refuse fork publishing');
  assert.ok(refuseFork.run.includes(`"$GITHUB_REPOSITORY" != '${EXPECTED_REPOSITORY}'`));
});

test('only the publish step holds the publish token, after the read-only preflight and the package gates', () => {
  const steps = workflow('publish-npm.yml').jobs.publish.steps;
  const tokens = steps.filter((s) => s.env?.NODE_AUTH_TOKEN);
  assert.equal(tokens.length, 2);
  const [preflight, publish] = tokens;
  assert.equal(preflight.env.NODE_AUTH_TOKEN, '${{ secrets.PLUGIN_CHECK_REGISTRY_TOKEN }}');
  assert.equal(publish.env.NODE_AUTH_TOKEN, '${{ secrets.VERDACCIO_PUBLISH_TOKEN }}');
  assert.equal(preflight.id, 'checker');
  assert.doesNotMatch(preflight.run, /npm publish/u);
  assert.match(publish.run, /npm publish \.release\/\*\.tgz --ignore-scripts --registry="\$NPM_REGISTRY"/u);
  // An unreachable or unauthorized registry must not read as "not published yet".
  assert.match(publish.run, /\*E404\*/u);
  assert.match(publish.run, /Refusing to overwrite/u);
  const pack = steps.findIndex((s) => s.run?.includes('npm pack --pack-destination .release --ignore-scripts'));
  assert.ok(pack >= 0 && pack < steps.indexOf(publish));
  // Publishing skips lifecycle scripts, so a prepublishOnly gate has to run as its own step first.
  const gate = manifest.scripts?.prepublishOnly;
  if (gate) {
    const index = steps.findIndex((s) => s.run?.trim() === gate);
    assert.ok(index >= 0 && index < steps.indexOf(publish), `prepublishOnly gate must run before publishing: ${gate}`);
  }
});

test('without the read-only secret the preflight warns and skips the package check instead of failing', () => {
  const preflight = workflow('publish-npm.yml').jobs.publish.steps.find((s) => s.id === 'checker');
  const dir = mkdtempSync(join(tmpdir(), 'plugin-checker-'));
  try {
    const output = join(dir, 'output');
    const run = spawnSync('bash', ['-c', preflight.run], { encoding: 'utf8', env: { ...process.env, NODE_AUTH_TOKEN: '', GITHUB_OUTPUT: output } });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /::warning::.*PLUGIN_CHECK_REGISTRY_TOKEN/u);
    assert.equal(readFileSync(output, 'utf8').trim(), 'enabled=false');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
