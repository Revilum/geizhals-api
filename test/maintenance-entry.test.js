'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const entry = path.resolve(__dirname, '..', 'update-filters.js');

test('importing the legacy maintenance entry point does no filesystem or network work', async () => {
  const effects = [];
  const filesystem = {
    readFileSync: () => '{"categories":{}}',
    existsSync: () => false,
    mkdirSync: () => effects.push('mkdir'),
    writeFile: () => effects.push('write'),
    readdirSync: () => [],
    rmSync: () => effects.push('remove')
  };
  const mockedRequire = name => {
    if (name === 'fs') return filesystem;
    if (name === './utils') return {sleep: async () => {}, getDirectories: () => []};
    if (name === './helper/GetCategories') {
      return {getCategories: async () => { effects.push('request'); return {}; }};
    }
    if (name.startsWith('./helper/')) return {};
    throw new Error('Unexpected import: ' + name);
  };
  const moduleObject = {exports: {}};
  vm.runInNewContext(fs.readFileSync(entry, 'utf8'), {
    require: mockedRequire, module: moduleObject, exports: moduleObject.exports, console
  }, {filename: entry});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(effects, []);
});

test('legacy maintenance CLI fails clearly without creating files in the working directory', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geizhals-maintenance-'));
  try {
    const result = spawnSync(process.execPath, [entry], {cwd: temporary, encoding: 'utf8', timeout: 10000});
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /legacy filter updater is disabled/i);
    assert.match(result.stderr, /github\.com\/Revilum\/geizhals-api\/pull\/3/);
    assert.deepEqual(fs.readdirSync(temporary), []);
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
});
