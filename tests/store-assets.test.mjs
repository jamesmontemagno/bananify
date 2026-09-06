import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { icon } from "../scripts/generate-icons.mjs";

const files = [
  ["icon-128.png", 128, 128],
  ["icon-300.png", 300, 300],
  ["promo-440x280.png", 440, 280],
  ["screenshot-party.png", 1280, 800],
  ["screenshot-restored.png", 1280, 800],
];

test("store listing images have the required PNG dimensions", async () => {
  for (const [name, width, height] of files) {
    const bytes = await readFile(new URL(`../store/assets/${name}`, import.meta.url));
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), name);
    assert.equal(bytes.readUInt32BE(16), width, name);
    assert.equal(bytes.readUInt32BE(20), height, name);
  }
  for (const size of [128, 300]) {
    assert.deepEqual(await readFile(new URL(`../store/assets/icon-${size}.png`, import.meta.url)), icon(size));
  }
  const before = await readFile(new URL("../store/assets/screenshot-party.png", import.meta.url));
  const after = await readFile(new URL("../store/assets/screenshot-restored.png", import.meta.url));
  assert.notDeepEqual(before, after);
});

test("the store kit documents manual submission prerequisites and asset provenance", async () => {
  const kit = await readFile(new URL("../store/README.md", import.meta.url), "utf8");
  for (const [name] of files) assert.ok(kit.includes(`assets/${name}`), name);
  assert.match(kit, /release\/bananify-store\.zip/);
  assert.match(kit, /not implemented by this kit/);
  const capture = JSON.parse(await readFile(new URL("../store/assets/capture.json", import.meta.url), "utf8"));
  assert.match(capture.version, /^\d+\.\d+\.\d+$/);
  assert.equal(capture.source, "dist/downloads/bananify-store.zip");
  assert.deepEqual(capture.screenshots, { width: 1280, height: 800 });
  for (const name of ["artwork.js", "party.js", "toggle.js"]) {
    assert.match(capture.runtimeSHA256[name], /^[a-f0-9]{64}$/);
  }
});
