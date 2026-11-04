'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const entry = path.resolve(__dirname, '..', 'update-filters.js');

test('importing the maintenance entry point does not start a filter refresh', async () => {
  const effects = [];
  const mockedRequire = name => {
    if (name === './lib/filter-updater') {
      return {refreshFilters: async () => { effects.push('refresh'); return {}; }};
    }
    throw new Error('Unexpected import: ' + name);
  };
  const moduleObject = {exports: {}};
  vm.runInNewContext(fs.readFileSync(entry, 'utf8'), {
    require: mockedRequire, module: moduleObject, exports: moduleObject.exports, console
  }, {filename: entry});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(effects, []);
  assert.equal(typeof moduleObject.exports.parseOptions, 'function');
  assert.equal(typeof moduleObject.exports.main, 'function');
});

test('maintenance CLI help and invalid options exit without crawling or creating files', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geizhals-maintenance-'));
  try {
    for (const [args, status, pattern] of [
      [['--help'], 0, /Usage:/],
      [['--max-pages', '0'], 1, /must be an integer between/],
      [['--unknown'], 1, /Unknown command-line option/]
    ]) {
      const result = spawnSync(process.execPath, [entry, ...args], {cwd: temporary, encoding: 'utf8', timeout: 10000});
      assert.ifError(result.error);
      assert.equal(result.status, status);
      assert.match(result.stdout + result.stderr, pattern);
      assert.deepEqual(fs.readdirSync(temporary), []);
    }
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
});
