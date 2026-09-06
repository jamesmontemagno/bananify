"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clampDensity,
  CelebrationGate,
  decorationVariant,
  encouragement,
  encouragements,
  isMonkeyViewMessage,
  isPartyMessage,
  monkeyNames,
  PartyState,
  selectDecoratedLines,
  shouldDecorateGutter,
  shouldDecorateLine,
} = require("../core");

test("density is parsed and constrained to the supported range", () => {
  assert.equal(clampDensity(undefined), 5);
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
  assert.ok([...low].every((line) => high.has(line)));
});

test("each monkey gives a named, known encouragement", () => {
  const message = encouragement("golden", 2);
  assert.match(message, /^Henry says: /);
  assert.ok(encouragements.some((entry) => message.endsWith(entry)));
  assert.match(encouragement("unknown", 0), /^Mooch says: /);
  assert.deepEqual(monkeyNames, {
    brown: "Mooch",
    "black-and-white": "Sebastian",
    golden: "Henry",
  });
});

test("gutter monkeys are deterministic and intentionally sparse", () => {
  const uri = "file:///workspace/example.js";
  const selected = Array.from(
    { length: 1000 },
    (_, line) => line,
  ).filter((line) => shouldDecorateGutter(uri, line));
  assert.ok(selected.length > 10);
  assert.ok(selected.length < 80);
  assert.deepEqual(
    selected,
    Array.from({ length: 1000 }, (_, line) => line)
      .filter((line) => shouldDecorateGutter(uri, line)),
  );
});

test("decoration variants stay stable while providing visual variety", () => {
  const variants = new Set();
  for (let line = 0; line < 200; line += 1) {
    const first = decorationVariant("file:///workspace/example.js", line, 4);
    assert.equal(first, decorationVariant("file:///workspace/example.js", line, 4));
    variants.add(first);
  }
  assert.deepEqual([...variants].sort(), [0, 1, 2, 3]);
});

test("visible-line selection handles split editors without scanning hidden lines", () => {
  const visited = [];
  const select = (uri, lines) => selectDecoratedLines(
    uri,
    lines,
    (line) => {
      visited.push(`${uri}:${line}`);
      return line !== 3;
    },
    5,
    2,
  );
  const left = select("file:///left.js", [0, 1, 2, 3, 4]);
  const right = select("file:///right.js", [100, 101, 102]);
  assert.equal(visited.length, 8);
  assert.ok(visited.every((entry) => !entry.endsWith(":99")));
  assert.ok(left.bananas.every((line) => line >= 0 && line <= 4 && line !== 3));
  assert.ok(right.bananas.every((line) => line >= 100 && line <= 102));
  assert.ok(left.gutters.length <= 2);
  assert.ok(right.gutters.length <= 2);
});

test("webview messages accept only explicit commands and known monkey ids", () => {
  assert.equal(isPartyMessage({ command: "pause" }), true);
  assert.equal(isPartyMessage({ command: "stop" }), true);
  assert.equal(isPartyMessage({ command: "stop", extra: true }), false);
  assert.equal(isPartyMessage({ command: "unknown" }), false);
  assert.equal(isMonkeyViewMessage({ command: "party" }), true);
  assert.equal(isMonkeyViewMessage({ command: "monkey", monkey: "golden" }), true);
  assert.equal(isMonkeyViewMessage({ command: "monkey", monkey: "unknown" }), false);
});

test("celebrations require enabled settings, successful tasks, and cooldown", () => {
  const gate = new CelebrationGate(5000);
  assert.equal(gate.trySave(false, 1000), false);
  assert.equal(gate.trySave(true, 1000), true);
  assert.equal(gate.trySave(true, 2000), false);
  assert.equal(gate.tryTask(true, 1, 7000), false);
  assert.equal(gate.tryTask(true, undefined, 7000), false);
  assert.equal(gate.tryTask(true, 0, 7000), true);
  gate.reset();
  assert.equal(gate.tryTask(true, 0, 7001), true);
});

test("party state pauses hidden and reduced-motion webviews and restores cleanly", () => {
  const state = new PartyState();
  state.open(false);
  assert.equal(state.shouldAnimate, true);
  state.setVisible(false);
  assert.equal(state.shouldAnimate, false);
  state.setVisible(true);
  state.togglePaused();
  assert.equal(state.shouldAnimate, false);
  state.togglePaused();
  state.setReducedMotion(true);
  assert.equal(state.shouldAnimate, false);
  state.restore();
  assert.deepEqual(
    {
      active: state.active,
      paused: state.paused,
      visible: state.visible,
      shouldAnimate: state.shouldAnimate,
    },
    { active: false, paused: false, visible: false, shouldAnimate: false },
  );
});
