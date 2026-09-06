"use strict";

const monkeyNames = Object.freeze({
  brown: "Mochi",
  "black-and-white": "Pepper",
  golden: "Sunny",
});

const encouragements = Object.freeze([
  "You are doing an ape-solutely brilliant job!",
  "One small commit is still a big step forward.",
  "Stay curious. The next bunch of ideas is almost ripe!",
  "Your code has serious a-peel.",
]);

function clampDensity(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(5, Math.max(1, parsed)) : 2;
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function shouldDecorateLine(uri, line, density) {
  const divisor = 14 - (clampDensity(density) * 2);
  return hash(`${uri}:${line}`) % divisor === 0;
}

function encouragement(monkey, seed = Date.now()) {
  const name = monkeyNames[monkey] || monkeyNames.brown;
  const message = encouragements[Math.abs(Number(seed) || 0) % encouragements.length];
  return `${name} says: ${message}`;
}

module.exports = {
  clampDensity,
  encouragement,
  encouragements,
  monkeyNames,
  shouldDecorateLine,
};
