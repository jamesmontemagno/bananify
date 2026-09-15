"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "../src/Bananify");
function snapshot() {
  const files = [
    "Web/party.html",
    ...fs.readdirSync(path.join(root, "Assets")).filter((file) => file.endsWith(".svg")).map((file) => `Assets/${file}`),
    ...fs.readdirSync(path.join(root, "Themes")).filter((file) => file.endsWith(".vstheme")).map((file) => `Themes/${file}`),
  ].sort();
  return files.map((file) => ({
    file,
    // Git on Windows may check out CRLF even though the generators emit LF.
    hash: createHash("sha256").update(fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n")).digest("hex"),
  }));
}
const before = snapshot();
for (const script of ["generate-assets.cjs", "generate-themes.cjs"]) {
  execFileSync(process.execPath, [path.join(__dirname, script)], { stdio: "inherit" });
}
assert.deepEqual(snapshot(), before,
  "Generated party assets or themes were stale. Review and retain the regenerated files.");
console.log("Bundled artwork and themes match their original Bananify sources.");
