"use strict";

const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { runTests } = require("@vscode/test-electron");

async function main() {
  const agents = process.argv.includes("--agents");
  const profilePath = mkdtempSync(path.join(tmpdir(), "bananify-vscode-"));
  try {
    await runTests({
      version: agents ? "insiders" : "1.96.4",
      vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
      extensionDevelopmentPath: path.resolve(__dirname, "../.."),
      extensionTestsPath: path.resolve(__dirname, "suite.js"),
      extensionTestsEnv: { BANANIFY_SMOKE_AGENTS: agents ? "1" : "0" },
      launchArgs: [
        ...(agents ? ["--agents"] : []),
        "--disable-extensions",
        "--disable-workspace-trust",
        `--extensions-dir=${path.join(profilePath, "extensions")}`,
        "--skip-release-notes",
        "--skip-welcome",
        `--user-data-dir=${path.join(profilePath, "user-data")}`,
      ],
    });
  } finally {
    rmSync(profilePath, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error("VS Code extension smoke test failed:", error);
  process.exitCode = 1;
});
