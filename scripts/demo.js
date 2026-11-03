'use strict';

// Deliberately synthetic HTML: this example needs no website or browser access.
const assert = require('node:assert/strict');
const api = require('..');
const html = `
<section class="startpage__top10">
  <article class="galleryview__item">
    <h3><a class="galleryview__name-link" href="/example-gpu-a12345.html">Example GPU</a></h3>
    <div class="galleryview__price"><span class="gh_price">€ 1.299,00</span></div>
  </article>
</section>`;

async function main() {
  const items = await api.getTop10({html});
  assert.equal(items.length, 1);
  assert.equal(items[0].price, '€1299.00');
  const searchURL = api.getURL({type: 'search', query: 'Ryzen', minPrice: 100, maxPrice: 500});
  assert.equal(api.detectPageType(searchURL), 'search');
  console.log('Offline example — synthetic data; no network requests.');
  console.log(JSON.stringify({items, searchURL}, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
