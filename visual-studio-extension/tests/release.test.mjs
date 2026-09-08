import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { checkReleaseVersion, sourceVersion, readSourceVersion } = require("../scripts/release-version.cjs");
const script = fileURLToPath(new URL("../scripts/release-version.cjs", import.meta.url));

for (const version of ["0.1.0", "1.2.3", "1.2.3.4", "65535.0.0"]) {
  test(`release version ${version} accepts its exact tag and non-release builds`, () => {
    assert.equal(checkReleaseVersion(version, `visualstudio-v${version}`), version);
    assert.equal(checkReleaseVersion(version), version);
  });
}

test("release checks reject malformed or mismatched tags and versions", () => {
  for (const version of [undefined, null, 123, "", "1.2", "01.2.3", "1.2.3.4.5", "1.2.65536", "-1.2.3", "1.2.3-beta", "1.2.3+build", "1.2.3\n"]) {
    assert.throws(() => checkReleaseVersion(version), /VSIX version/);
  }
  for (const tag of ["visualstudio-v1.2.4", "visualstudio-v1.2.3.0", "visualstudio-v1.2.3-beta", "vscode-v1.2.3", "v1.2.3", "main", "visualstudio-v1.2.3\n", "visualstudio-v1.2.3; exit 0", null]) {
    assert.throws(() => checkReleaseVersion("1.2.3", tag), /Release tag must be/);
  }
});

test("source validation uses Identity.Version and requires matching build metadata", () => {
  const manifest = '<PackageManifest Version="2.0.0"><Metadata><Identity Id="example" Version="1.2.3" /></Metadata></PackageManifest>';
  const props = '<Project><PropertyGroup><Version>1.2.3</Version></PropertyGroup></Project>';
  assert.equal(sourceVersion(manifest, props), "1.2.3");
  assert.equal(sourceVersion('<!-- <Identity Version="9.9.9" /> -->' + manifest, props), "1.2.3");
  assert.equal(sourceVersion(manifest.replace('Version="1.2.3"', "Version='1.2.3'"), props), "1.2.3");
  assert.throws(() => sourceVersion(manifest, props.replace("1.2.3", "1.2.4")), /must match/);
  assert.throws(() => sourceVersion("<PackageManifest />", props), /Expected one/);
  assert.throws(() => sourceVersion(manifest + manifest, props), /Expected one/);
  assert.throws(() => sourceVersion(manifest, props + props), /Expected one/);
});

test("release CLI validates the actual source and packaged version without stamping files", () => {
  const version = readSourceVersion();
  const run = (args, tag = "") => spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, RELEASE_TAG: tag }, encoding: "utf8",
  });
  for (const result of [run([]), run([], `visualstudio-v${version}`), run([version, `visualstudio-v${version}`]), run([version])]) {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Verified Visual Studio version/);
  }
  const wrong = version === "9.9.9" ? "8.8.8" : "9.9.9";
  for (const result of [run([], `visualstudio-v${wrong}`), run([wrong]), run([wrong, `visualstudio-v${version}`]), run([""], `visualstudio-v${version}`), run([], "vscode-v1.2.3")]) {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.trim());
  }
  assert.equal(readSourceVersion(), version);
});

test("workflow source restricts publishing to successful Visual Studio tag builds", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/visual-studio.yml", import.meta.url), "utf8");
  assert.match(workflow, /tags: \["visualstudio-v\*"\]/);
  assert.match(workflow, /permissions:\s+contents: read/);
  const [build, publish] = workflow.split(/\r?\n  publish:\r?\n/);
  assert.ok(publish, "Missing separate publish job");
  assert.match(publish, /if: github.event_name == 'push' && startsWith\(github.ref, 'refs\/tags\/visualstudio-v'\)/);
  assert.match(publish, /needs: build/);
  assert.match(publish, /runs-on: windows-2022/);
  assert.ok(publish.includes("dotnet restore visual-studio-extension/src/Bananify/Bananify.csproj"));
  assert.ok(publish.includes("src/Bananify/obj/project.assets.json"));
  assert.ok(publish.includes("Microsoft.VSSDK.BuildTools/*"));
  assert.ok(publish.includes("/tools/vssdk/bin/VsixPublisher.exe"));
  assert.doesNotMatch(publish, /always\(\)|continue-on-error|msbuild|dotnet build/);
  assert.match(build, /RELEASE_TAG: \$\{\{ github.ref_type == 'tag' && github.ref_name \|\| '' \}\}/);
  assert.ok(build.indexOf("scripts/release-version.cjs") < build.indexOf("/t:Rebuild"));
  assert.ok(build.includes("tests/release.test.mjs"));
  assert.match(publish, /RELEASE_TAG: \$\{\{ github.ref_name \}\}/);
  assert.match(build, /name: bananify-visual-studio/);
  assert.match(publish, /name: bananify-visual-studio/);
  assert.ok(publish.includes("$packages.Count -ne 1"));
  assert.ok(publish.includes("Verify-Vsix.ps1 -Path $packages[0].FullName -ReleaseTag $env:RELEASE_TAG"));
  assert.ok(publish.indexOf("Verify-Vsix.ps1") < publish.indexOf("& $publisher publish"));
  assert.ok(publish.indexOf("& $publisher publish") < publish.indexOf("softprops/action-gh-release"));
  assert.match(publish, /VSIX_PATH: \$\{\{ steps.package.outputs.path \}\}/);
  assert.match(publish, /files: \$\{\{ steps.package.outputs.path \}\}/);
  assert.match(publish, /fail_on_unmatched_files: true/);
  assert.match(publish, /make_latest: "false"/);
  for (const [, action] of workflow.matchAll(/uses: ([^\s#]+)/g)) {
    assert.match(action, /@[a-f0-9]{40}$/, `Action must remain SHA pinned: ${action}`);
  }
});

test("workflow source scopes credentials to public publishing and propagates publisher failures", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/visual-studio.yml", import.meta.url), "utf8");
  const [before, after] = workflow.split("      - name: Publish tested VSIX and listing assets");
  assert.doesNotMatch(before, /secrets\./);
  assert.ok(after);
  assert.match(after, /VSCE_PAT: \$\{\{ secrets.VSCE_PAT \|\| secrets.VSCE_TOKEN \}\}/);
  assert.ok(after.includes("[string]::IsNullOrWhiteSpace($env:VSCE_PAT)"));
  assert.ok(after.includes("$metadata.publisher -ne 'vs-publisher-473885' -or $metadata.private -ne $false"));
  assert.ok(after.includes("-payload $env:VSIX_PATH -publishManifest $publishManifest -personalAccessToken $env:VSCE_PAT"));
  assert.ok(after.includes('if ($LASTEXITCODE -ne 0) { throw "Marketplace publishing failed'));
  assert.doesNotMatch(after, /-ignoreWarnings|Write-(Host|Output).*VSCE_PAT/);
  const run = after.split("        run: |")[1].split("      - name: Create GitHub release")[0];
  assert.doesNotMatch(run, /\$\{\{/, "Untrusted values and secrets must enter the script via environment variables");
});

test("VSIX verifier source validates the embedded version before accepting a tagged artifact", async () => {
  const verifier = await readFile(new URL("../Verify-Vsix.ps1", import.meta.url), "utf8");
  assert.ok(verifier.includes("$ReleaseTag = $env:RELEASE_TAG"));
  assert.ok(verifier.includes("$manifest.PackageManifest.Metadata.Identity.Version"));
  assert.ok(verifier.includes("'scripts/release-version.cjs') $version $ReleaseTag"));
  assert.ok(verifier.includes('if ($LASTEXITCODE -ne 0) { throw "Packaged VSIX version'));
  assert.ok(verifier.indexOf("scripts/release-version.cjs") < verifier.indexOf("VSIX payload inspected"));
});
