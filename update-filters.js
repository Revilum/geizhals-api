#!/usr/bin/env node
'use strict';

const {refreshFilters} = require('./lib/filter-updater');

const HELP = `Usage: node update-filters.js [options]

  --dry-run                    Parse and report without writing catalog files
  --rotate                     Rotate main, subcategory and leaf-category traversal weekly
  --output PATH                Output directory (default: ./filters)
  --max-pages N                Request budget: 1..300 (default: 80)
  --delay-ms N                 Delay between live requests: 1000..60000 (default: 3000)
  --category-offset N          Starting main-category index (0..1000000)
  --category-limit N           Main categories per run (1..1000000)
  --subcategory-offset N       Starting subcategory index (0..1000000)
  --subcategory-limit N        Subcategories per selected main category (1..1000000)
  --final-category-offset N    Starting leaf-category index (0..1000000)
  --final-category-limit N     Leaf categories per selected subcategory (1..1000000)
  --help, -h                   Display this help without making requests

HTTP 401/403/429 stop the entire crawl before staged catalogs are written.
Existing entries absent from a fetched page are retained for manual review.
No publication, default-branch push or merge is performed by this command.
`;

function parseOptions(argv) {
  const opts = {};
  const numeric = {
    '--max-pages': ['maxPages', 1, 300],
    '--delay-ms': ['delayMs', 1000, 60000],
    '--category-offset': ['categoryOffset', 0, 1000000],
    '--category-limit': ['categoryLimit', 1, 1000000],
    '--subcategory-offset': ['subcategoryOffset', 0, 1000000],
    '--subcategory-limit': ['subcategoryLimit', 1, 1000000],
    '--final-category-offset': ['finalCategoryOffset', 0, 1000000],
    '--final-category-limit': ['finalCategoryLimit', 1, 1000000]
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--dry-run') { opts.dryRun = true; continue; }
    if (arg === '--rotate') { opts.rotate = true; continue; }
    if (arg === '--output') {
      const value = argv[++i];
      if (typeof value !== 'string' || !value.trim() || value.startsWith('-')) {
        throw new TypeError('Missing --output path');
      }
      opts.outputDir = value;
      continue;
    }
    if (Object.hasOwn(numeric, arg)) {
      const value = argv[++i];
      if (!/^\d+$/.test(String(value ?? ''))) {
        throw new TypeError('Expected a nonnegative integer for ' + arg);
      }
      const [key, min, max] = numeric[arg];
      const number = Number(value);
      if (arg === '--delay-ms' && number < 1000) {
        throw new RangeError('Use at least 1000 ms between live requests');
      }
      if (!Number.isSafeInteger(number) || number < min || number > max) {
        throw new RangeError(arg + ' must be an integer between ' + min + ' and ' + max);
      }
      opts[key] = number;
      continue;
    }
    throw new TypeError('Unknown command-line option: ' + arg);
  }
  return opts;
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseOptions(argv);
  if (opts.help) { console.log(HELP); return null; }
  const result = await refreshFilters(opts);
  console.log(JSON.stringify(result, null, 2));
  if (result.partial) {
    console.warn('Partial catalog coverage: ' + result.partialReasons.join(', ') + '. Review before merging.');
  }
  return result;
}

if (require.main === module) {
  main().catch(error => {
    console.error('Filter refresh stopped:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {parseOptions, main, HELP};
