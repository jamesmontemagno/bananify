"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { bananaSvg, monkeySvg, palettes } = require("../artwork");

test("website-derived monkey artwork keeps every identity and held banana in bounds", () => {
  assert.deepEqual(Object.keys(palettes), ["brown", "black-and-white", "golden"]);
  for (const monkey of Object.keys(palettes)) {
    const svg = monkeySvg(monkey);
    assert.match(svg, /viewBox="-12 -12 314 304"/);
    assert.match(svg, /overflow="visible"/);
    assert.match(svg, /class="held-banana"/);
    assert.match(svg, /width="80" height="80"/);
  }
});

test("banana artwork is reusable at explicit and responsive sizes", () => {
  const svg = bananaSvg("test-banana");
  assert.match(svg, /class="test-banana"/);
  assert.match(svg, /viewBox="0 0 80 80"/);
  assert.match(svg, /overflow="visible"/);
});
