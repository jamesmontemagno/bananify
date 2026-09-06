"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clampDensity,
  encouragement,
  encouragements,
  shouldDecorateLine,
} = require("../core");

test("density is parsed and constrained to the supported range", () => {
  assert.equal(clampDensity(undefined), 2);
  assert.equal(clampDensity("4"), 4);
  assert.equal(clampDensity(-10), 1);
  assert.equal(clampDensity(99), 5);
});

test("banana positions are deterministic and density only adds decorations", () => {
  const uri = "file:///workspace/example.js";
  const low = new Set();
  const high = new Set();
  for (let line = 0; line < 500; line += 1) {
    if (shouldDecorateLine(uri, line, 1)) low.add(line);
    if (shouldDecorateLine(uri, line, 5)) high.add(line);
    assert.equal(shouldDecorateLine(uri, line, 3), shouldDecorateLine(uri, line, 3));
  }
  assert.ok(high.size > low.size);
});

test("each monkey gives a named, known encouragement", () => {
  const message = encouragement("golden", 2);
  assert.match(message, /^Sunny says: /);
  assert.ok(encouragements.some((entry) => message.endsWith(entry)));
  assert.match(encouragement("unknown", 0), /^Mochi says: /);
});
