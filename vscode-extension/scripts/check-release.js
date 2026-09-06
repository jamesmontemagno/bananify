"use strict";

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
const tag = process.env.RELEASE_TAG || "";

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(packageJson.version)) {
  throw new Error("The VS Code extension version must be major.minor.patch.");
}
if (tag && tag !== `vscode-v${packageJson.version}`) {
  throw new Error(`Release tag ${tag} must match vscode-v${packageJson.version}.`);
}

console.log(`VS Code extension release ${packageJson.version} is valid.`);
