"use strict";

// Only Bananify's original artwork is shared with the VS Code extension.
const fs = require("node:fs");
const path = require("node:path");
const { bananaSvg, monkeySvg, palettes } = require("../../vscode-extension/artwork");
const root = path.resolve(__dirname, "../src/Bananify");
const assetDirectory = path.join(root, "Assets");
fs.mkdirSync(assetDirectory, { recursive: true });
function trimLineEnds(text) {
  return text.replace(/[ \t]+$/gm, "");
}
function svgDocument(svg) {
  return trimLineEnds(svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
}
fs.writeFileSync(path.join(assetDirectory, "banana.svg"), svgDocument(bananaSvg()));
for (const monkey of Object.keys(palettes)) {
  fs.writeFileSync(path.join(assetDirectory, `monkey-${monkey}.svg`), svgDocument(monkeySvg(monkey)));
}
const template = fs.readFileSync(path.join(root, "Web/party.template.html"), "utf8");
const html = template.replace("<!-- MONKEYS -->", Object.keys(palettes).map((monkey) =>
  `<button class="monkey-choice" data-monkey="${monkey}" aria-label="Choose ${palettes[monkey].name}" aria-pressed="false">${monkeySvg(monkey, "party-monkey")}<span>${palettes[monkey].name}</span></button>`
).join("\n")).replace("<!-- BANANA -->", bananaSvg("banana-art"));
fs.writeFileSync(path.join(root, "Web/party.html"), trimLineEnds(html));
