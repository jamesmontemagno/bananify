"use strict";

const assert = require("node:assert/strict");
const vscode = require("vscode");

const extensionId = "vs-publisher-473885.bananify";
const expectedCommands = [
  "bananify.toggle",
  "bananify.moreBananas",
  "bananify.openParty",
  "bananify.showPartyExplorer",
  "bananify.pause",
  "bananify.restore",
  "bananify.selectTheme",
  "bananify.cheer",
];

async function run() {
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Expected ${extensionId} to be installed in the Extension Host.`);

  await extension.activate();
  assert.equal(extension.isActive, true);

  const commands = await vscode.commands.getCommands(true);
  for (const command of expectedCommands) {
    assert.ok(commands.includes(command), `Expected ${command} to be registered.`);
  }

  await vscode.commands.executeCommand("bananify.openParty");
  await vscode.commands.executeCommand("bananify.showPartyExplorer");
  await vscode.commands.executeCommand("bananify.restore");
}

module.exports = { run };
