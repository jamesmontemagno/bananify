"use strict";

const monkeyNames = Object.freeze({
  brown: "Mooch",
  "black-and-white": "Sebastian",
  golden: "Henry",
});

const bananaThemes = Object.freeze([
  Object.freeze({ label: "Banana Grove", description: "Warm grove greens and ripe banana gold" }),
  Object.freeze({ label: "Banana Cream", description: "A bright, creamy daytime theme" }),
  Object.freeze({ label: "Midnight Banana", description: "Deep navy with moonlit banana yellow" }),
  Object.freeze({ label: "Monkey Jungle", description: "Canopy greens with earthy capuchin warmth" }),
]);

const partyMessageCommands = new Set(["start", "pause", "stop"]);
const monkeyViewCommands = new Set([
  "toggle",
  "more",
  "theme",
  "cheer",
  "party",
  "partyExplorer",
]);

const encouragements = Object.freeze([
  "You are doing an ape-solutely brilliant job!",
  "One small commit is still a big step forward.",
  "Stay curious. The next bunch of ideas is almost ripe!",
  "Your code has serious a-peel.",
]);

function clampDensity(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(5, Math.max(1, parsed)) : 5;
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
  return hash(`${uri}:${line}`) % 100 < clampDensity(density) * 8;
}

function shouldDecorateGutter(uri, line) {
  return hash(`gutter:${uri}:${line}`) % 100 < 7;
}

function decorationVariant(uri, line, variants) {
  return hash(`variant:${uri}:${line}`) % variants;
}

function selectDecoratedLines(uri, visibleLines, isDecoratable, density, gutterLimit) {
  const bananas = [];
  const gutters = [];
  for (const line of new Set(visibleLines)) {
    if (!isDecoratable(line)) continue;
    if (shouldDecorateLine(uri, line, density)) bananas.push(line);
    if (gutters.length < gutterLimit && shouldDecorateGutter(uri, line)) gutters.push(line);
  }
  return { bananas, gutters };
}

function encouragement(monkey, seed = Date.now()) {
  const name = monkeyNames[monkey] || monkeyNames.brown;
  const message = encouragements[Math.abs(Number(seed) || 0) % encouragements.length];
  return `${name} says: ${message}`;
}

function isPartyMessage(message) {
  return Boolean(
    message
      && typeof message === "object"
      && Object.keys(message).length === 1
      && partyMessageCommands.has(message.command),
  );
}

function isMonkeyViewMessage(message) {
  if (!message || typeof message !== "object" || typeof message.command !== "string") {
    return false;
  }
  if (message.command === "monkey") {
    return Object.keys(message).length === 2 && Object.hasOwn(monkeyNames, message.monkey);
  }
  return Object.keys(message).length === 1 && monkeyViewCommands.has(message.command);
}

class CelebrationGate {
  constructor(cooldownMs = 5000) {
    this.cooldownMs = cooldownMs;
    this.lastCelebration = Number.NEGATIVE_INFINITY;
  }

  trySave(enabled, now = Date.now()) {
    return enabled && this.tryStart(now);
  }

  tryTask(enabled, exitCode, now = Date.now()) {
    return enabled && exitCode === 0 && this.tryStart(now);
  }

  tryStart(now) {
    if (now - this.lastCelebration < this.cooldownMs) return false;
    this.lastCelebration = now;
    return true;
  }

  reset() {
    this.lastCelebration = Number.NEGATIVE_INFINITY;
  }
}

class PartyState {
  constructor() {
    this.active = false;
    this.paused = false;
    this.visible = false;
    this.reducedMotion = false;
  }

  open(reducedMotion) {
    this.active = true;
    this.paused = false;
    this.visible = true;
    this.reducedMotion = Boolean(reducedMotion);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
  }

  setReducedMotion(reducedMotion) {
    this.reducedMotion = Boolean(reducedMotion);
  }

  togglePaused() {
    if (this.active) this.paused = !this.paused;
  }

  restore() {
    this.active = false;
    this.paused = false;
    this.visible = false;
  }

  get shouldAnimate() {
    return this.active && this.visible && !this.paused && !this.reducedMotion;
  }
}

module.exports = {
  bananaThemes,
  CelebrationGate,
  clampDensity,
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
};
