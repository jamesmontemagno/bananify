import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const source = new URL("../src/Bananify/", import.meta.url);

test("VSIX has explicit API and architecture targets, package and MEF assets", async () => {
  const manifest = await readFile(new URL("source.extension.vsixmanifest", source), "utf8");
  assert.match(manifest, /Version="\[17\.14,\)"/);
  assert.match(manifest, /<ProductArchitecture>amd64<\/ProductArchitecture>/);
  assert.match(manifest, /<ProductArchitecture>arm64<\/ProductArchitecture>/);
  assert.match(manifest, /Type="Microsoft\.VisualStudio\.VsPackage"/);
  assert.match(manifest, /Type="Microsoft\.VisualStudio\.MefComponent"/);
  assert.doesNotMatch(manifest, /Version="\[18\.0/);
});

test("native commands and VSCT registration agree", async () => {
  const [commands, host] = await Promise.all([
    readFile(new URL("Commands.vsct", source), "utf8"),
    readFile(new URL("BananifyPackage.cs", source), "utf8"),
  ]);
  const ids = [...host.matchAll(/Add(?:Async)?Command\(commands, (0x[0-9a-f]+)/g)].map((match) => match[1]);
  assert.equal(ids.length, 8);
  for (const id of ids) assert.ok(commands.includes(`value="${id}"`), `Missing command ${id}`);
  assert.ok(host.includes('ProvideMenuResource("Menus.ctmenu", 1)'));
});

test("native project remains isolated and uses Windows-only VSIX tooling", async () => {
  const project = await readFile(new URL("Bananify.csproj", source), "utf8");
  assert.match(project, /<TargetFramework>net48<\/TargetFramework>/);
  assert.match(project, /Microsoft\.VSSDK\.BuildTools.+Condition="'\$\(OS\)' == 'Windows_NT'"/);
  assert.doesNotMatch(project, /vscode-extension/);
});

test("the party host JSON dependency is explicitly included despite VSSDK suppression", async () => {
  const [project, verifier] = await Promise.all([
    readFile(new URL("Bananify.csproj", source), "utf8"),
    readFile(new URL("../Verify-Vsix.ps1", import.meta.url), "utf8"),
  ]);
  const reference = project.match(/<PackageReference\b[^>]*\bInclude="Newtonsoft\.Json"[^>]*\/>/)?.[0];
  assert.ok(reference, "Missing direct Newtonsoft.Json dependency");
  assert.match(reference, /\bForceIncludeInVSIX="true"/);
  assert.ok(verifier.includes('"Newtonsoft.Json.dll"'), "Payload inspection must require the JSON assembly");
});

test("all four IDE themes have distinct identities and modern shell tokens", async () => {
  const directory = new URL("Themes/", source);
  const manifest = await readFile(new URL("source.extension.vsixmanifest", source), "utf8");
  const names = (await readdir(directory)).filter((name) => name.endsWith(".vstheme"));
  assert.equal(names.length, 4);
  const identities = new Set();
  const labels = new Set();
  for (const name of names) {
    const registration = name.replace(/\.vstheme$/, ".pkgdef");
    assert.ok(manifest.includes(`Type="Microsoft.VisualStudio.VsPackage" Path="Themes\\${registration}"`),
      `Missing package registration for ${name}`);
    const xml = await readFile(new URL(name, directory), "utf8");
    const theme = xml.match(/<Theme\s[^>]*>/)?.[0];
    assert.ok(theme, `Missing Theme element in ${name}`);
    const id = theme.match(/\bGUID="([^"]+)"/)?.[1];
    assert.ok(id, `Missing stable identity in ${name}`);
    identities.add(id);
    labels.add(theme.match(/\bName="([^"]+)"/)?.[1]);
    assert.match(theme, /FallbackId="\{[a-f0-9-]+\}"/i);
    assert.match(xml, /Category Name="Shell"/);
    assert.match(xml, /Category Name="ShellInternal"/);
    assert.match(xml, /AccentFillDefault/);
  }
  assert.equal(identities.size, 4);
  assert.deepEqual([...labels].sort(), ["Banana Cream", "Banana Grove", "Midnight Banana", "Monkey Jungle"]);
});
