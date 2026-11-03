'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('..');

const fixtures = [
  {
    parse: api.parseCategories,
    key: 'hardware',
    html: image => '<div class="mkat"><a title="Hardware" href="/?m=1">' + image + '</a></div>'
  },
  {
    parse: api.parseSubCategories,
    key: 'processors',
    html: image => '<div class="mocat-item"><a class="mocat-item__link" href="/?o=4">Processors</a>' + image + '</div>'
  },
  {
    parse: api.parseFinalCategories,
    key: 'processors',
    html: image => '<div class="mocat-item"><a class="mocat-item__link" href="/?cat=cpuamdam4">Processors</a>' + image + '</div>'
  }
];

for (const domain of ['geizhals.at', 'geizhals.eu']) {
  test('category parsers resolve relative img and srcset against ' + domain, () => {
    const baseURL = 'https://' + domain + '/catalog/';
    for (const {parse, key, html} of fixtures) {
      assert.equal(parse(html('<img src="images/category.png">'), baseURL)[key].img,
        baseURL + 'images/category.png');
      assert.equal(parse(html('<picture><source srcset="/category.webp 1x, /category@2x.webp 2x"></picture>'), baseURL)[key].img,
        'https://' + domain + '/category.webp');
    }
  });
}

test('subcategory and final-category endpoints pass their source URL to the parser', async () => {
  const subcategory = await api.getSubCategories('https://geizhals.at/?m=1', {
    html: fixtures[1].html('<img src="/processors.png">')
  });
  assert.equal(subcategory.processors.img, 'https://geizhals.at/processors.png');

  const finalCategory = await api.getFinalCategories('https://geizhals.eu/?o=4', {
    html: fixtures[2].html('<picture><source srcset="/processors.webp 1x, /processors@2x.webp 2x"></picture>')
  });
  assert.equal(finalCategory.processors.img, 'https://geizhals.eu/processors.webp');
});

test('category default origins and relative source URLs retain the configured base', async () => {
  for (const {parse, key, html} of fixtures) {
    assert.equal(parse(html('<img src="/category.png">'))[key].img,
      'https://geizhals.de/category.png');
  }
  const main = await api.getCategories({html: fixtures[0].html('<img src="/category.png">')});
  assert.equal(main.hardware.img, 'https://geizhals.de/category.png');
  const subcategory = await api.getSubCategories('/?m=1', {html: fixtures[1].html('<img src="/category.png">')});
  assert.equal(subcategory.processors.img, 'https://geizhals.de/category.png');
  const finalCategory = await api.getFinalCategories('/?o=4', {html: fixtures[2].html('<img src="/category.png">')});
  assert.equal(finalCategory.processors.img, 'https://geizhals.de/category.png');
});

test('category base URLs preserve explicit absolute CDN image origins', () => {
  const imageURL = 'https://gzhls.at/pix/category.webp';
  for (const {parse, key, html} of fixtures) {
    assert.equal(parse(html('<img src="' + imageURL + '">'), 'https://geizhals.at/')[key].img, imageURL);
    assert.equal(parse(html('<picture><source srcset="' + imageURL + ' 1x"></picture>'), 'https://geizhals.eu/')[key].img, imageURL);
  }
});
