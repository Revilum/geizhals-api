'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['node_modules', '.git', 'tmp', 'filters', 'coverage']);
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory() && !excluded.has(entry.name)) collect(location);
    if (entry.isFile() && /\.[cm]?js$/.test(entry.name)) files.push(location);
  }
}
collect(root);
for (const filename of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', filename], {stdio: 'inherit'});
  if (result.error || result.status !== 0) {
    console.error('Syntax check failed:', path.relative(root, filename), result.error?.message || '');
    process.exit(1);
  }
}
console.log('Syntax checked ' + files.length + ' JavaScript files, including helpers, tests and maintenance scripts.');
