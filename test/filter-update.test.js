'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const updater=require('../lib/filter-updater');
const {parseOptions}=require('../update-filters');

const pages={
  '/':'<a class="nav-m-link" href="/?m=1">Hardware</a>',
  'm:1':'<div class="mocat-item"><a href="./?o=5">CPUs</a><a href="./?o=5">CPUs</a></div>',
  'o:5':'<div class="mocat-item"><a href="./?cat=cpuamdam4">AMD processors</a></div>',
  'cat:cpuamdam4':'<div class="xf_tr"><div class="xf_th">Manufacturer:</div><div class="xf_td"><a href="./?xf=7781_AMD"><span class="xf_v">AMD</span></a><a href="./?xf=7781_Intel"><span class="xf_v">Intel</span></a></div></div>'
};
function fetchFixture(pageMap=pages,calls=[]) {
  return async url=>{
    calls.push(url);
    const u=new URL(url);
    const key=u.searchParams.has('m') ? 'm:'+u.searchParams.get('m')
      :u.searchParams.has('o')?'o:'+u.searchParams.get('o')
      :u.searchParams.has('cat')?'cat:'+u.searchParams.get('cat'):'/';
    if(!Object.prototype.hasOwnProperty.call(pageMap,key))throw new Error('HTTP 403');
    return pageMap[key];
  };
}
function tmp() {return fs.mkdtempSync(path.join(os.tmpdir(),'gh-updater-'));}

test('accept only Geizhals HTTPS URLs and safe slugs',()=>{
  assert.equal(updater.geizhalsUrl('/?m=1'),'https://geizhals.de/?m=1');
  assert.throws(()=>updater.geizhalsUrl('https://geizhals.de.evil.test/'),/Only HTTPS/);
  assert.throws(()=>updater.geizhalsUrl('file:///etc/passwd'),/Only HTTPS/);
  assert.equal(updater.slug('Gráfikkarten & PCIe'),'grafikkarten-pcie');
  assert.deepEqual(updater.parseNavigation('<a class="nav-m-link" href="/?m=1">Hardware</a>','m'),[{name:'hardware',param:'1'}]);
});
test('parse legacy filter links with deterministic sort order',()=>{
  assert.deepEqual(updater.parseFilters(pages['cat:cpuamdam4']),{
    manufacturer:{amd:'7781_AMD',intel:'7781_Intel'}
  });
  assert.deepEqual(updater.parseFilters('<html></html>'),{});
});
test('safe updater writes only verified, nonempty catalogs',async()=>{
  const dir=tmp();const calls=[];
  try{
    const first=await updater.refreshFilters({fetchPage:fetchFixture(pages,calls),delayMs:0,outputDir:dir,maxPages:10});
    assert.equal(first.requests,4);
    assert.equal(first.parsed,1);
    assert.equal(first.changed,1);
    assert.equal(calls.length,4);
    const dest=path.join(dir,'hardware-m1','cpus-o5','amd-processors-cpuamdam4.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(dest,'utf8')),updater.parseFilters(pages['cat:cpuamdam4']));
    const second=await updater.refreshFilters({fetchPage:fetchFixture(),delayMs:0,outputDir:dir,maxPages:10});
    assert.equal(second.changed,0);
    assert.equal(second.parsed,1);
    assert.equal(fs.readdirSync(path.dirname(dest)).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('errors fail without deleting old filter catalogs',async()=>{
  const dir=tmp();
  try{
    await updater.refreshFilters({fetchPage:fetchFixture(),delayMs:0,outputDir:dir,maxPages:10});
    const file=path.join(dir,'hardware-m1','cpus-o5','amd-processors-cpuamdam4.json');
    const before=fs.readFileSync(file,'utf8');
    await assert.rejects(updater.refreshFilters({fetchPage:fetchFixture({...pages,'cat:cpuamdam4':'<div>no filter DOM</div>'}),delayMs:0,outputDir:dir,maxPages:10}),/No nonempty filter data/);
    assert.equal(fs.readFileSync(file,'utf8'),before);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('dry-run reports changes and writes no files',async()=>{
  const dir=tmp();
  try{
    const stats=await updater.refreshFilters({fetchPage:fetchFixture(),delayMs:0,outputDir:path.join(dir,'new'),dryRun:true,maxPages:10});
    assert.equal(stats.changed,1);
    assert.equal(stats.dryRun,true);
    assert.equal(fs.existsSync(path.join(dir,'new')),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('request budget caps crawling and prevents partial overwrites',async()=>{
  const dir=tmp(),calls=[];
  try{
    await assert.rejects(updater.refreshFilters({fetchPage:fetchFixture(pages,calls),delayMs:0,outputDir:dir,maxPages:3}),/No nonempty filter data/);
    assert.equal(calls.length,3);
    assert.equal(fs.readdirSync(dir).length,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('safe CLI validation and repeatable rotation',async()=>{
  assert.deepEqual(parseOptions(['--dry-run','--rotate','--max-pages','20','--delay-ms','1000']),{dryRun:true,rotate:true,maxPages:20,delayMs:1000});
  assert.throws(()=>parseOptions(['--delay-ms','100']),/at least 1000/);
  assert.throws(()=>parseOptions(['--strange']),/Unknown/);
  assert.throws(()=>parseOptions(['--max-pages','NaN']),/nonnegative/);
  const dir=tmp();
  try{
    const a=await updater.refreshFilters({fetchPage:fetchFixture(),delayMs:0,outputDir:dir,maxPages:10,now:Date.UTC(2026,10,3),rotate:true});
    assert.equal(a.parsed,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
