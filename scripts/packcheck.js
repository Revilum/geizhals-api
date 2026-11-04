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
  for (const required of ['index.js', 'getURL.js', 'utils.js', 'endpoints/reviews.js', 'helper/getFilters.js', 'config/global.json', 'README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'docs/audit.md', 'LICENSE']) {
    assert.ok(included.has(required), 'Missing packaged file: ' + required);
  }
  assert.ok(!included.has('endpoints/item.json'), 'Sample scraped output must not be packaged');
  assert.ok(![...included].some(file => /(^|\/)(node_modules|\.git|test|tmp)\//.test(file)), 'Development artifacts leaked into package');
  for (const filename of ['update-filters.js', 'lib/filter-updater.js', 'docs/filter-updates.md']) {
    assert.ok(included.has(filename), 'Missing maintenance package file: ' + filename);
  }
  const consumer = path.join(temporary, 'consumer');
  fs.mkdirSync(consumer);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const sourceLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.ok(sourceLock.lockfileVersion >= 2 && sourceLock.packages?.[''], 'A current package-lock.json is required');
  const packageEntry = {...sourceLock.packages['']};
  for (const field of ['name', 'version', 'dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'bin']) {
    assert.deepEqual(packageEntry[field], manifest[field], 'package-lock.json is out of date: ' + field);
  }
  assert.ok(!sourceLock.packages['node_modules/' + manifest.name], 'The package cannot depend on itself');
  // npm ci caches locked tarballs, but not the registry metadata needed by
  // npm install to resolve dependency ranges. Reuse that exact dependency graph
  // for the consumer so the check also works with a freshly seeded CI cache.
  const tarball = 'file:../' + packed.filename;
  const consumerManifest = {
    name: 'geizhals-package-smoke', version: '1.0.0', private: true,
    dependencies: {[manifest.name]: tarball}
  };
  delete packageEntry.devDependencies;
  packageEntry.resolved = tarball;
  packageEntry.integrity = packed.integrity;
  const consumerLock = {
    name: consumerManifest.name, version: consumerManifest.version,
    lockfileVersion: sourceLock.lockfileVersion, requires: true,
    packages: {
      ...sourceLock.packages,
      '': consumerManifest,
      ['node_modules/' + manifest.name]: packageEntry
    }
  };
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify(consumerManifest));
  fs.writeFileSync(path.join(consumer, 'package-lock.json'), JSON.stringify(consumerLock));
  npm(['ci', '--offline', '--ignore-scripts', '--omit=dev', '--omit=optional', '--no-audit', '--no-fund'], consumer);
  const code = "const assert=require('node:assert/strict'); const api=require('geizhals-api'); for(const method of ['search','getListing','getItem','getTop10','getReviews','getURL','getFilters','refreshFilters']) assert.equal(typeof api[method],'function',method); assert.equal(new URL(api.getURL('CPU')).searchParams.get('fs'),'CPU');";
  const result = spawnSync(process.execPath, ['-e', code], {cwd: consumer, encoding: 'utf8', timeout: 20000});
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  const installedManifest = JSON.parse(fs.readFileSync(path.join(consumer, 'node_modules', manifest.name, 'package.json'), 'utf8'));
  assert.deepEqual(installedManifest.bin, {'geizhals-update-filters': 'update-filters.js'});
  const binary = path.join(consumer, 'node_modules', '.bin', 'geizhals-update-filters' + (process.platform === 'win32' ? '.cmd' : ''));
  assert.ok(fs.existsSync(binary), 'The installed maintenance binary must be linked');
  const help = npm(['exec', '--offline', '--no', '--', 'geizhals-update-filters', '--help'], consumer);
  assert.match(help, /Usage:/);
  console.log('Packed ' + packed.filename + '; offline installation, public API and maintenance CLI consumer smoke tests passed. No npm publication performed.');
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
