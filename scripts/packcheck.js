'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const npmCLI = process.env.npm_execpath;
if (!npmCLI) throw new Error('Run this check using npm run packcheck');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geizhals-package-'));

function npm(args, cwd) {
  // Invoke the JS CLI directly: no platform-specific shell or npm.cmd quoting.
  const result = spawnSync(process.execPath, [npmCLI, ...args], {
    cwd, encoding: 'utf8', timeout: 180000,
    env: {...process.env, npm_config_update_notifier: 'false'}
  });
  if (result.error || result.status !== 0) {
    throw new Error('npm ' + args[0] + ' failed: ' + (result.error?.message || result.stderr));
  }
  return result.stdout;
}

try {
  const [packed] = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], root));
  const included = new Set(packed.files.map(file => file.path));
  for (const required of ['index.js', 'getURL.js', 'utils.js', 'endpoints/reviews.js', 'helper/getFilters.js', 'config/global.json', 'README.md', 'LICENSE']) {
    assert.ok(included.has(required), 'Missing packaged file: ' + required);
  }
  assert.ok(!included.has('endpoints/item.json'), 'Sample scraped output must not be packaged');
  assert.ok(![...included].some(file => /(^|\/)(node_modules|\.git|test|tmp)\//.test(file)), 'Development artifacts leaked into package');
  for (const filename of ['update-filters.js', 'lib/filter-updater.js', 'docs/filter-updates.md']) {
    assert.ok(included.has(filename), 'Missing maintenance package file: ' + filename);
  }
  const consumer = path.join(temporary, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({name: 'geizhals-package-smoke', version: '1.0.0', private: true}));
  npm(['install', '--offline', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund', '--package-lock=false', path.join(temporary, packed.filename)], consumer);
  const code = "const assert=require('node:assert/strict'); const api=require('geizhals-api'); for(const method of ['search','getListing','getItem','getTop10','getReviews','getURL','getFilters','refreshFilters']) assert.equal(typeof api[method],'function',method); assert.equal(new URL(api.getURL('CPU')).searchParams.get('fs'),'CPU');";
  const result = spawnSync(process.execPath, ['-e', code], {cwd: consumer, encoding: 'utf8', timeout: 60000});
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  const help = spawnSync(process.execPath, [path.join(consumer, 'node_modules/geizhals-api/update-filters.js'), '--help'], {cwd: consumer, encoding: 'utf8', timeout: 60000});
  assert.equal(help.status, 0, help.error?.message || help.stderr);
  assert.match(help.stdout, /Usage:/);
  console.log('Packed ' + packed.filename + '; offline installation and public API consumer smoke test passed. No npm publication performed.');
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
