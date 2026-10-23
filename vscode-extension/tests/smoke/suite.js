"use strict";

const assert = require("node:assert/strict");
const vscode = require("vscode");

const extensionId = "vs-publisher-473885.bananify";
const expectedCommands = [
  "bananify.toggle",
  "bananify.moreBananas",
  "bananify.openParty",
  "bananify.showPartyExplorer",
  "bananify.selectTheme",
  "bananify.cheer",
];

async function run() {
  const originalTheme = vscode.workspace.getConfiguration("workbench").get("colorTheme");
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Expected ${extensionId} to be installed in the Extension Host.`);

  await extension.activate();
  assert.equal(extension.isActive, true);
  assert.equal(vscode.workspace.getConfiguration("workbench").get("colorTheme"), originalTheme);

  const commands = await vscode.commands.getCommands(true);
  for (const command of expectedCommands) {
    assert.ok(commands.includes(command), `Expected ${command} to be registered.`);
  }

  if (process.env.BANANIFY_SMOKE_AGENTS === "1") {
    assert.equal(extension.packageJSON.capabilities.agentsWindow.supported, true);
    assert.equal(
      vscode.workspace.getConfiguration("extensions").get("supportAgentsWindow")?.[extensionId],
      undefined,
      "Agents smoke tests must not bypass the manifest with a user override.",
    );
    return;
  }

  await vscode.commands.executeCommand("bananify.openParty");
  await vscode.commands.executeCommand("bananify.showPartyExplorer");
  await vscode.commands.executeCommand("bananify.toggle");
}

module.exports = { run };
