import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReleaseVersion, readReleaseVersion } from "../scripts/release-version.mjs";

const metadata = (version) => [
  { version }, { version }, { version, packages: { "": { version } } },
];

test("release version matches all manifests and the pushed tag", async () => {
  assert.equal(validateReleaseVersion(...metadata("1.1.0"), "v1.1.0"), "1.1.0");
  assert.equal(validateReleaseVersion(...metadata("1.1.0")), "1.1.0");
  await readReleaseVersion();
});

test("mismatched tags, manifests, and lockfiles cannot be released", () => {
  for (const tag of ["v1.0.0", "1.1.0", "v1.1.0-beta", "v1.1.0; echo nope"]) {
    assert.throws(() => validateReleaseVersion(...metadata("1.1.0"), tag), /does not match/);
  }
  for (const index of [1, 2]) {
    const values = metadata("1.1.0");
    values[index].version = "1.0.0";
    assert.throws(() => validateReleaseVersion(...values), /same version/);
  }
  const values = metadata("1.1.0");
  values[2].packages[""].version = "1.0.0";
  assert.throws(() => validateReleaseVersion(...values), /same version/);
});

test("release versions are valid stable browser-extension versions", () => {
  for (const version of ["0.0.0", "1.0", "01.2.3", "65536.0.0", "1.2.3-beta", "1.2.3.4", null]) {
    assert.throws(() => validateReleaseVersion(...metadata(version)), /major.minor.patch/);
  }
});
