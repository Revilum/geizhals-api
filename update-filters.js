'use strict';

const {refreshFilters} = require('./lib/filter-updater');

function parseOptions(argv) {
  const opts={};
  const numeric={
    '--max-pages':'maxPages',
    '--delay-ms':'delayMs',
    '--category-offset':'categoryOffset',
    '--category-limit':'categoryLimit',
    '--subcategory-offset':'subcategoryOffset',
    '--subcategory-limit':'subcategoryLimit'
  };
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--dry-run'){opts.dryRun=true;continue;}
    if(arg==='--rotate'){opts.rotate=true;continue;}
    if(arg==='--output'){
      if(!argv[i+1])throw new TypeError('Missing --output path');
      opts.outputDir=argv[++i];continue;
    }
    if(numeric[arg]) {
      const value=argv[++i];
      if(!/^\d+$/.test(String(value||'')))throw new TypeError('Expected a nonnegative integer for '+arg);
      opts[numeric[arg]]=Number(value);
      continue;
    }
    throw new TypeError('Unknown command-line option: '+arg);
  }
  if(opts.delayMs!==undefined && opts.delayMs<1000) {
    throw new RangeError('Use at least 1000 ms between live requests');
  }
  return opts;
}

async function main(argv=process.argv.slice(2)){
  const opts=parseOptions(argv);
  const result=await refreshFilters(opts);
  console.log(JSON.stringify(result,null,2));
  if(result.errors.length)console.warn('Some pages failed; review incomplete catalogs before merging.');
  return result;
}

if(require.main===module){
  main().catch(error=>{
    console.error('Filter refresh stopped:',error.message);
    process.exitCode=1;
  });
}

module.exports={parseOptions,main};
