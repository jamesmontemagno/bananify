import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path, { win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const source = new URL("../src/Bananify/", import.meta.url);

test("Marketplace overview images resolve locally and through publishing asset mappings", async () => {
  const publishUrl = new URL("../vs-publish.json", import.meta.url);
  const manifest = JSON.parse(await readFile(publishUrl, "utf8"));
  assert.equal(manifest.publisher, "vs-publisher-473885");
  assert.deepEqual(Object.keys(manifest.identity), ["internalName"]);
  assert.equal(manifest.identity.internalName, "Bananify.VisualStudio");
  assert.equal(manifest.priceCategory, "free");
  assert.equal(manifest.private, false);
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  const overviewUrl = new URL(manifest.overview, publishUrl);
  const overview = await readFile(overviewUrl, "utf8");
  const images = [...overview.matchAll(/!\[([^\]]+)\]\(([^\s)]+)\)/g)];
  assert.ok(images.length > 0, "The listing must include a screenshot with alt text");
  const assets = new Map(manifest.assetFiles.map((asset) => [asset.targetPath, asset]));
  assert.equal(assets.size, manifest.assetFiles.length, "Asset targets must be unique");
  for (const [, alt, target] of images) {
    assert.ok(alt.trim());
    assert.ok(!target.includes("..") && !target.includes(":") && !target.startsWith("/"), "Use a relative Marketplace asset target");
    const asset = assets.get(target);
    assert.ok(asset, `Missing Marketplace asset for ${target}`);
    const uploadUrl = new URL(asset.pathOnDisk, publishUrl);
    assert.equal(uploadUrl.href, new URL(target, overviewUrl).href, "GitHub preview and Marketplace must use the same original image");
    const png = await readFile(uploadUrl);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, "Screenshot dimensions must be positive");
  }
  assert.equal(assets.size, images.length, "Every uploaded screenshot should appear in the overview");
});

test("VSIX summary covers the listing features without bundling Marketplace-only assets", async () => {
  const [manifest, project, workflow] = await Promise.all([
    readFile(new URL("source.extension.vsixmanifest", source), "utf8"),
    readFile(new URL("Bananify.csproj", source), "utf8"),
    readFile(new URL("../../.github/workflows/visual-studio.yml", import.meta.url), "utf8"),
  ]);
  const description = manifest.match(/<Description\b[^>]*>([^<]+)<\/Description>/)?.[1];
  assert.ok(description && description.length <= 500, "Keep the listing summary concise");
  for (const feature of ["Visual Studio 2026", "decorations", "party panels", "encouragement", "celebrations", "themes", "badges"])
    assert.ok(description.includes(feature), `Summary omits ${feature}`);
  assert.match(manifest, /<Tags>[^<]*;[^<]*<\/Tags>/);
  assert.doesNotMatch(project, /visual-studio-marketplace\.md|visual-studio-extension\.png|vs-publish\.json/);
  assert.equal(workflow.split('"docs/visual-studio-*"').length - 1, 2, "Both push and PR checks should cover listing changes");
});

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

test("manifest icon and license match linked VSIX content without renaming source files", async () => {
  const [project, manifest, verifier] = await Promise.all([
    readFile(new URL("Bananify.csproj", source), "utf8"),
    readFile(new URL("source.extension.vsixmanifest", source), "utf8"),
    readFile(new URL("../Verify-Vsix.ps1", import.meta.url), "utf8"),
  ]);
  for (const tag of ["Icon", "License"]) {
    const path = manifest.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1];
    assert.ok(path, `Missing manifest ${tag}`);
    const content = [...project.matchAll(/<Content\b([^>]+)>([\s\S]*?)<\/Content>/g)]
      .find((match) => match[1].includes(`Link="${path}"`));
    assert.ok(content, `Missing linked content for ${path}`);
    const include = content[1].match(/\bInclude="([^"]+)"/)?.[1];
    assert.ok(include);
    assert.equal(win32.basename(path), win32.basename(include), "VSIX links cannot rename source files");
    assert.match(content[2], /<IncludeInVSIX>true<\/IncludeInVSIX>/);
    assert.ok(verifier.includes(`"${path.replaceAll("\\", "/")}"`), `Payload inspection must require ${path}`);
  }
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

const themeCases = [
  ["banana-grove", "BananaGrove", "9d569ac6-ea15-45ec-9ab9-5663fa8d3b63", "dark"],
  ["banana-cream", "BananaCream", "67f82e36-25f5-4de5-9bfd-d1875a01f387", "light"],
  ["midnight-banana", "MidnightBanana", "08108a81-5cc0-4332-a19b-e9a1ac650094", "dark"],
  ["monkey-jungle", "MonkeyJungle", "cd7ccac6-92f7-45d3-b7c8-f3c04d6d944d", "dark"],
];
const categoryGuids = {
  Environment: "624ed9c3-bdfd-41fa-96c3-7c824ea32e3d",
  "Text Editor": "a27b4e24-a735-4d1d-b8e7-9716e1e3d8e0",
  Shell: "73708ded-2d56-4aad-b8eb-73b20d3f4bff",
  ShellInternal: "5af241b7-5627-4d12-bfb1-2b67d11127d7",
  TreeView: "92ecf08e-8b13-4cf4-99e9-ae2692382185",
};
const syntaxScopes = {
  Comment: "comment",
  "XML Doc Comment": "comment",
  "XML Doc Comment - Delimiter": "comment",
  String: "string",
  "String - Verbatim": "string",
  Keyword: "keyword",
  "Control Keyword": "keyword",
  "Preprocessor Keyword": "keyword",
  Number: "constant.numeric",
  Identifier: "variable",
  "User Types": "entity.name.type",
  "User Types - Classes": "entity.name.type",
  "User Types - Interfaces": "entity.name.type",
  "User Types - Enums": "entity.name.type",
  "User Types - Structs": "entity.name.type",
  "User Types - Delegates": "entity.name.type",
  "XML Doc Comment - Name": "entity.name.type",
  "User Members - Methods": "entity.name.function",
  "User Members - Extension Methods": "entity.name.function",
  "User Members - Properties": "variable",
  "User Members - Fields": "variable",
  "User Members - Events": "variable",
  "User Members - Parameters": "variable",
  "User Members - Local Variables": "variable",
};

async function evaluateGenerator(transform = () => {}) {
  const generatorUrl = new URL("../scripts/generate-themes.cjs", import.meta.url);
  const script = await readFile(generatorUrl, "utf8");
  const palettes = new Map(await Promise.all(themeCases.map(async ([slug]) => {
    const palette = JSON.parse(await readFile(new URL(`../../vscode-extension/themes/${slug}-color-theme.json`, import.meta.url), "utf8"));
    transform(palette);
    return [slug, palette];
  })));
  const directory = fileURLToPath(new URL("Themes/", source));
  const writes = new Map();
  const fakeFs = Object.freeze({
    mkdirSync(target, options) {
      assert.equal(path.resolve(target), path.resolve(directory));
      assert.equal(options?.recursive, true);
    },
    writeFileSync(target, content) {
      assert.equal(path.dirname(target), path.resolve(directory));
      const name = path.basename(target);
      assert.ok(themeCases.some(([, filename]) => name === `${filename}.vstheme`), `Unexpected write: ${target}`);
      assert.equal(typeof content, "string");
      assert.ok(!writes.has(name), `Duplicate write: ${name}`);
      writes.set(name, content);
    },
  });
  const helpers = runInNewContext(`${script}\n;({ scopeForeground, opaqueSelection, readableMuted });`, {
    __dirname: path.dirname(fileURLToPath(generatorUrl)),
    require(id) {
      if (id === "node:fs") return fakeFs;
      if (id === "node:path") return path;
      const slug = /^\.\.\/\.\.\/vscode-extension\/themes\/([a-z-]+)-color-theme\.json$/.exec(id)?.[1];
      assert.ok(palettes.has(slug), `Unexpected require: ${id}`);
      return palettes.get(slug);
    },
  }, { filename: fileURLToPath(generatorUrl), timeout: 5000 });
  assert.equal(writes.size, themeCases.length);
  return { writes, palettes, helpers };
}

function attributes(text) {
  return Object.fromEntries([...text.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function parseTheme(xml) {
  const header = xml.match(/<Theme\s+([^>]+)>/);
  assert.ok(header, "Missing theme header");
  const categories = new Map();
  for (const [, raw, body] of xml.matchAll(/<Category\s+([^>]+)>([\s\S]*?)<\/Category>/g)) {
    const { Name: name, GUID: guid } = attributes(raw);
    assert.ok(!categories.has(name), `Duplicate category ${name}`);
    const colors = new Map();
    for (const [, tokenRaw, tokenBody] of body.matchAll(/<Color\s+([^>]+)>([\s\S]*?)<\/Color>/g)) {
      const { Name: token } = attributes(tokenRaw);
      assert.ok(!colors.has(token), `Duplicate token ${name}/${token}`);
      const slots = {};
      for (const [, slot, slotRaw] of tokenBody.matchAll(/<(Background|Foreground)\s+([^>]+)\/>/g)) {
        const { Type: type, Source: value } = attributes(slotRaw);
        assert.equal(type, "CT_RAW", `${name}/${token}/${slot}`);
        assert.match(value, /^[A-F0-9]{8}$/, `${name}/${token}/${slot}`);
        assert.ok(!Object.hasOwn(slots, slot), `Duplicate slot ${name}/${token}/${slot}`);
        slots[slot] = value;
      }
      assert.ok(Object.keys(slots).length, `Missing color slots for ${name}/${token}`);
      colors.set(token, slots);
    }
    categories.set(name, { guid, colors });
  }
  return { header: attributes(header[1]), categories };
}

function argbColor(color) {
  assert.match(color, /^#[a-f\d]{6}(?:[a-f\d]{2})?$/i);
  return ((color.length === 9 ? color.substring(7) : "ff") + color.substring(1, 7)).toUpperCase();
}

function slots(theme, category, token) {
  const result = theme.categories.get(category)?.colors.get(token);
  assert.ok(result, `Missing ${category}/${token}`);
  return result;
}

function expectSlots(theme, category, token, expected) {
  assert.deepEqual(slots(theme, category, token),
    Object.fromEntries(Object.entries(expected).map(([slot, color]) => [slot, argbColor(color)])),
    `${category}/${token} must use the native color slot and semantic palette source`);
}

function semanticForeground(palette, scope) {
  const token = palette.tokenColors.findLast((entry) => {
    const scopes = typeof entry.scope === "string" ? entry.scope.split(/\s*,\s*/).map((value) => value.trim()) : entry.scope ?? [];
    return scopes.includes(scope) && entry.settings.foreground;
  });
  return token?.settings.foreground ?? palette.colors["editor.foreground"];
}

function rgb(argb) {
  assert.match(argb, /^[a-f\d]{8}$/i);
  return [2, 4, 6].map((offset) => parseInt(argb.substring(offset, offset + 2), 16));
}

function composite(foreground, background) {
  const alpha = parseInt(foreground.substring(0, 2), 16);
  const back = rgb(background);
  return "FF" + rgb(foreground).map((channel, i) =>
    Math.round((channel * alpha + back[i] * (255 - alpha)) / 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function contrast(foreground, background) {
  const luminance = (color) => rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  assert.ok(background.startsWith("FF"), "Contrast needs an opaque background");
  const values = [luminance(composite(foreground, background)), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

for (const [slug, filename, id, type] of themeCases) {
  test(`${filename}: committed theme matches in-memory generation and stable identities`, async () => {
    const { writes, palettes } = await evaluateGenerator();
    const generated = writes.get(`${filename}.vstheme`);
    const committed = await readFile(new URL(`Themes/${filename}.vstheme`, source), "utf8");
    assert.equal(committed.replaceAll("\r\n", "\n"), generated.replaceAll("\r\n", "\n"),
      "Committed theme is stale; regenerate themes from the semantic palettes");
    const theme = parseTheme(generated);
    assert.equal(palettes.get(slug).type, type);
    assert.deepEqual(theme.header, {
      Name: palettes.get(slug).name,
      GUID: `{${id}}`,
      FallbackId: type === "light" ? "{de3dbbcd-f642-433c-8353-8f1df4370aba}" : "{1ded0138-47ce-435e-84ef-9ec1f439b749}",
    });
    assert.deepEqual([...theme.categories.keys()].sort(), Object.keys(categoryGuids).sort());
    for (const [name, guid] of Object.entries(categoryGuids)) assert.equal(theme.categories.get(name).guid, `{${guid}}`, name);
  });

  test(`${filename}: generated native slots follow semantic palette sources`, async () => {
    const { writes, palettes } = await evaluateGenerator();
    const palette = palettes.get(slug);
    const c = palette.colors;
    const theme = parseTheme(writes.get(`${filename}.vstheme`));
    for (const [token, scope] of Object.entries(syntaxScopes)) {
      expectSlots(theme, "Text Editor", token, { Foreground: semanticForeground(palette, scope) });
    }
    for (const token of ["Operator", "Punctuation"]) expectSlots(theme, "Text Editor", token, { Foreground: c["editor.foreground"] });
    expectSlots(theme, "Text Editor", "Plain Text", { Background: c["editor.background"], Foreground: c["editor.foreground"] });
    expectSlots(theme, "Text Editor", "Indicator Margin", { Background: c["editor.background"] });
    expectSlots(theme, "Text Editor", "Selected Line Number", { Foreground: c["editorLineNumber.activeForeground"] });
    expectSlots(theme, "Text Editor", "Inactive Selected Text", { Background: c["list.hoverBackground"], Foreground: c["editor.foreground"] });
    assert.deepEqual(slots(theme, "Text Editor", "Selected Text"), {
      Background: composite(argbColor(c["editor.selectionBackground"]), argbColor(c["editor.background"])),
      Foreground: argbColor(c["editor.foreground"]),
    }, "Selection must be alpha-composited over the editor, not emitted translucent or merely made opaque");
    const lineNumber = slots(theme, "Text Editor", "Line Number");
    assert.deepEqual(Object.keys(lineNumber), ["Foreground"]);
    assert.ok(!theme.categories.get("Text Editor").colors.has("Line Numbers"), "VS uses singular Line Number");
    const original = argbColor(c["editorLineNumber.foreground"]);
    if (contrast(original, argbColor(c["editor.background"])) >= 4.5) assert.equal(lineNumber.Foreground, original);

    const environmentBackgrounds = {
      "sideBar.background": ["ToolWindowBackground", "CommandBarGradientBegin", "CommandBarGradientEnd", "CommandBarMenuBackgroundGradientBegin", "CommandBarMenuBackgroundGradientEnd", "CommandBarMenuIconBackground"],
      "sideBar.foreground": ["ToolWindowText", "CommandBarTextActive", "FileTabText", "FileTabInactiveText"],
      "editor.foreground": ["CommandBarTextHover", "FileTabSelectedText", "FileTabHotText"],
      "panel.border": ["ToolWindowBorder", "CommandBarMenuBorder", "CommandBarMenuSeparator"],
      "tab.inactiveBackground": ["FileTabBackground", "FileTabBorder", "FileTabInactiveGradientTop", "FileTabInactiveGradientBottom", "FileTabInactiveBorder"],
      "tab.activeBackground": ["FileTabSelectedGradientTop", "FileTabSelectedGradientBottom", "FileTabSelectedBorder"],
      "tab.activeBorderTop": ["FileTabDocumentBorderBackground"],
      "list.hoverBackground": ["CommandBarMouseOverBackgroundBegin", "CommandBarMouseOverBackgroundEnd", "FileTabHotGradientTop", "FileTabHotGradientBottom", "FileTabHotBorder"],
      "activityBar.background": ["EnvironmentBackground"],
    };
    for (const [key, tokens] of Object.entries(environmentBackgrounds)) {
      for (const token of tokens) expectSlots(theme, "Environment", token, { Background: c[key] });
    }
    expectSlots(theme, "Environment", "CommandBarMenuItemMouseOver", { Background: c["list.hoverBackground"], Foreground: c["editor.foreground"] });
    expectSlots(theme, "Environment", "StatusBarDefault", { Background: c["statusBar.background"], Foreground: c["statusBar.foreground"] });
    for (const [token, key] of [["Background", "sideBar.background"], ["SelectedItemActive", "list.activeSelectionBackground"], ["SelectedItemInactive", "list.hoverBackground"]]) {
      expectSlots(theme, "TreeView", token, { Background: c[key], Foreground: c["sideBar.foreground"] });
    }
    for (const token of ["Glyph", "GlyphMouseOver", "SelectedItemActiveGlyph", "SelectedItemActiveGlyphMouseOver", "SelectedItemInactiveGlyph", "SelectedItemInactiveGlyphMouseOver"]) {
      expectSlots(theme, "TreeView", token, { Background: c["sideBar.foreground"] });
    }
    expectSlots(theme, "TreeView", "FocusVisualBorder", { Background: c["focusBorder"] });
    expectSlots(theme, "Shell", "AccentFillDefault", { Background: c["focusBorder"] });
    expectSlots(theme, "Shell", "AccentFillSecondary", { Background: c["focusBorder"] + "E5" });
    expectSlots(theme, "Shell", "AccentFillTertiary", { Background: c["focusBorder"] + "CC" });
    expectSlots(theme, "Shell", "TextOnAccentFillPrimary", { Background: type === "light" ? "#FFFFFF" : c["editor.background"] });
    expectSlots(theme, "Shell", "TextFillTertiary", { Background: semanticForeground(palette, "comment") });
    expectSlots(theme, "ShellInternal", "EnvironmentBodyText", { Background: c["sideBar.foreground"] });
  });

  test(`${filename}: actual native text/background pairings meet 4.5:1 contrast`, async () => {
    const { writes } = await evaluateGenerator();
    const theme = parseTheme(writes.get(`${filename}.vstheme`));
    const check = (category, textToken, textSlot, backgroundToken, backgroundSlot = "Background") => {
      const ratio = contrast(slots(theme, category, textToken)[textSlot], slots(theme, category, backgroundToken)[backgroundSlot]);
      assert.ok(ratio >= 4.5, `${filename} ${category}/${textToken}.${textSlot} on ${backgroundToken}.${backgroundSlot}: ${ratio.toFixed(3)}:1 < 4.5:1`);
    };
    for (const token of ["Plain Text", "Selected Text", "Inactive Selected Text"]) check("Text Editor", token, "Foreground", token);
    for (const token of ["Line Number", "Selected Line Number", ...Object.keys(syntaxScopes), "Operator", "Punctuation"]) check("Text Editor", token, "Foreground", "Plain Text");
    for (const [text, backgrounds] of [
      ["ToolWindowText", ["ToolWindowBackground"]],
      ["CommandBarTextActive", ["CommandBarGradientBegin", "CommandBarGradientEnd", "CommandBarMenuBackgroundGradientBegin", "CommandBarMenuBackgroundGradientEnd"]],
      ["CommandBarTextHover", ["CommandBarMouseOverBackgroundBegin", "CommandBarMouseOverBackgroundEnd"]],
      ["FileTabText", ["FileTabBackground"]],
      ["FileTabSelectedText", ["FileTabSelectedGradientTop", "FileTabSelectedGradientBottom"]],
      ["FileTabInactiveText", ["FileTabInactiveGradientTop", "FileTabInactiveGradientBottom"]],
      ["FileTabHotText", ["FileTabHotGradientTop", "FileTabHotGradientBottom"]],
    ]) {
      for (const background of backgrounds) check("Environment", text, "Background", background);
    }
    for (const token of ["CommandBarMenuItemMouseOver", "StatusBarDefault"]) check("Environment", token, "Foreground", token);
    for (const token of ["Background", "SelectedItemActive", "SelectedItemInactive"]) check("TreeView", token, "Foreground", token);
    check("Shell", "TextOnAccentFillPrimary", "Background", "AccentFillDefault");
    check("ShellInternal", "EnvironmentBodyText", "Background", "EnvironmentBody");
  });
}

test("semantic scope lookup handles reordered, missing, overriding, comma and array scopes", async () => {
  const baseline = await evaluateGenerator();
  const reordered = await evaluateGenerator((palette) => palette.tokenColors.reverse());
  for (const [name, xml] of baseline.writes) assert.equal(reordered.writes.get(name), xml, name);
  const scopes = [...new Set(Object.values(syntaxScopes))];
  for (const scope of scopes) {
    const theme = { colors: { "editor.foreground": "#112233" }, tokenColors: [
      { settings: { foreground: "#FFFFFF" } },
      { scope: `${scope}.unrelated`, settings: { foreground: "#FFFFFF" } },
    ] };
    const lookup = () => baseline.helpers.scopeForeground(theme, scope);
    assert.equal(lookup(), "#112233", `${scope}: missing exact scope falls back to editor foreground`);
    theme.tokenColors.push({ scope: ` unrelated, ${scope} , other `, settings: { foreground: "#223344" } });
    assert.equal(lookup(), "#223344", `${scope}: comma scopes are trimmed`);
    theme.tokenColors.push({ scope: ["unrelated", scope], settings: { foreground: "#334455" } });
    assert.equal(lookup(), "#334455", `${scope}: last matching foreground wins`);
    theme.tokenColors.push({ scope, settings: { fontStyle: "italic" } });
    assert.equal(lookup(), "#334455", `${scope}: style-only rules do not erase foreground`);
  }
  for (const mode of ["missing", "comma", "array"]) {
    const result = await evaluateGenerator((palette) => {
      palette.tokenColors = mode === "missing" ? [] : [
        { scope: scopes, settings: { foreground: "#123456" } },
        { scope: mode === "comma" ? ` ${scopes.join(" , ")} ` : scopes, settings: { foreground: "#654321" } },
        { scope: scopes, settings: { fontStyle: "bold" } },
      ];
    });
    for (const [slug, filename] of themeCases) {
      const theme = parseTheme(result.writes.get(`${filename}.vstheme`));
      const expected = mode === "missing" ? result.palettes.get(slug).colors["editor.foreground"] : "#654321";
      for (const token of Object.keys(syntaxScopes)) expectSlots(theme, "Text Editor", token, { Foreground: expected });
      expectSlots(theme, "Shell", "TextFillTertiary", { Background: expected });
    }
  }
});

test("selection compositing and readable muted helpers retain opaque/readable colors", async () => {
  const { helpers } = await evaluateGenerator();
  for (const [selection, background, expected] of [
    ["#123456", "#ABCDEF", "#123456"],
    ["#12345600", "#ABCDEF", "#abcdef"],
    ["#123456FF", "#ABCDEF", "#123456"],
    ["#FFFFFF80", "#000000", "#808080"],
    ["#00000080", "#FFFFFF", "#7f7f7f"],
    ["#E4BE5266", "#FFF8DF", "#f4e1a7"],
  ]) assert.equal(helpers.opaqueSelection(selection, background).toLowerCase(), expected.toLowerCase());
  for (const [muted, background, foreground] of [
    ["#222222", "#FFFFFF", "#000000"],
    ["#DDDDDD", "#000000", "#FFFFFF"],
    ["#999999", "#FFFFFF", "#000000"],
    ["#333333", "#000000", "#FFFFFF"],
  ]) {
    const actual = helpers.readableMuted(muted, background, foreground);
    assert.ok(contrast(argbColor(actual), argbColor(background)) >= 4.5, `${muted} on ${background} remains unreadable`);
    if (contrast(argbColor(muted), argbColor(background)) >= 4.5) assert.equal(actual, muted);
    const start = rgb(argbColor(muted));
    const target = rgb(argbColor(foreground));
    rgb(argbColor(actual)).forEach((channel, i) => assert.ok(channel >= Math.min(start[i], target[i]) && channel <= Math.max(start[i], target[i])));
  }
});

// These are source-wiring checks, not execution of C#, COM callbacks or WebView2 messages.
function nativeMethod(text, name) {
  const declaration = new RegExp(`^\\s*(?:public|private|protected|internal)\\s+[^\\r\\n=;{}]*\\b${name}\\([^)]*\\)\\s*(=>[^;]*;|\\{)`, "m").exec(text);
  assert.ok(declaration, `Missing native method ${name}`);
  if (declaration[1].startsWith("=>")) return declaration[1];
  const start = declaration.index + declaration[0].length;
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return text.slice(start, i);
  }
  assert.fail(`Unclosed native method ${name}`);
}

test("native source wiring: RDT v3 dispatches save after saving, never before", async () => {
  const [events, packageSource] = await Promise.all([
    readFile(new URL("IdeEvents.cs", source), "utf8"),
    readFile(new URL("BananifyPackage.cs", source), "utf8"),
  ]);
  assert.match(events, /class\s+IdeEvents\s*:[^{]*\bIVsRunningDocTableEvents3\b/);
  assert.match(events, /AdviseRunningDocTableEvents\(this,\s*out\s+_documentCookie\)/);
  assert.match(events, /UnadviseRunningDocTableEvents\(_documentCookie\)/);
  assert.match(packageSource, /_events\s*=\s*new\s+IdeEvents\(build,\s*documents\)/);
  const before = nativeMethod(events, "OnBeforeSave");
  assert.match(before, /VSConstants\.S_OK/);
  assert.doesNotMatch(before, /PartySession|Celebrat|OnAfterSave/);
  const after = nativeMethod(events, "OnAfterSave");
  assert.match(after, /PartySession\.Instance\.CelebrateSave\(\)/);
  assert.match(after, /return\s+VSConstants\.S_OK\s*;/);
  assert.equal([...events.matchAll(/PartySession\.Instance\.CelebrateSave\(\)/g)].length, 1);
  assert.match(nativeMethod(events, "UpdateSolution_Done"), /PartySession\.Instance\.CelebrateBuild\(_hasBuild\s*&&\s*!_failed\s*&&\s*fSucceeded\s*==\s*1,\s*_cancelled\s*\|\|\s*fCancelCommand\s*!=\s*0\)/);
});

test("native source wiring: typed save/build/more reasons flow from the shared session", async () => {
  const [args, session, host] = await Promise.all([
    readFile(new URL("CelebrationEventArgs.cs", source), "utf8"),
    readFile(new URL("PartySession.cs", source), "utf8"),
    readFile(new URL("ToolWindows/PartyHostControl.cs", source), "utf8"),
  ]);
  assert.match(args, /enum\s+CelebrationKind\s*\{\s*Save\s*,\s*Build\s*,\s*More\s*,?\s*\}/);
  assert.match(args, /CelebrationEventArgs\(CelebrationKind\s+kind\)\s*=>\s*Kind\s*=\s*kind/);
  assert.match(args, /CelebrationKind\s+Kind\s*\{\s*get\s*;\s*\}/);
  assert.match(session, /event\s+EventHandler<CelebrationEventArgs>\??\s+Celebrated/);
  assert.match(nativeMethod(session, "CelebrateSave"), /Celebrate\(_celebrateOnSave,\s*true,\s*false,\s*CelebrationKind\.Save\)/);
  assert.match(nativeMethod(session, "CelebrateBuild"), /Celebrate\(_celebrateOnBuild,\s*succeeded,\s*cancelled,\s*CelebrationKind\.Build\)/);
  assert.match(nativeMethod(session, "More"), /new\s+CelebrationEventArgs\(CelebrationKind\.More\)/);
  assert.match(nativeMethod(session, "Celebrate"), /new\s+CelebrationEventArgs\(kind\)/);
  const dispatch = nativeMethod(host, "Celebrated");
  for (const kind of ["Save", "Build", "More"]) assert.match(dispatch, new RegExp(`CelebrationKind\\.${kind}\\s*=>\\s*"${kind.toLowerCase()}"`));
  assert.match(dispatch, /Post\(new\s*\{\s*type\s*=\s*"celebrate",\s*reason\s*\}\)/);
  assert.match(host, /PartySession\.Instance\.Celebrated\s*\+=\s*Celebrated/);
  assert.match(host, /PartySession\.Instance\.Celebrated\s*-=\s*Celebrated/);
});

test("native source wiring: encouragement shares a provider and commands enforce strict payload shapes", async () => {
  const [session, host, packageSource] = await Promise.all([
    readFile(new URL("PartySession.cs", source), "utf8"),
    readFile(new URL("ToolWindows/PartyHostControl.cs", source), "utf8"),
    readFile(new URL("BananifyPackage.cs", source), "utf8"),
  ]);
  assert.match(session, /private\s+readonly\s+EncouragementProvider\s+_encouragement\s*=\s*new\s+EncouragementProvider\(\)/);
  assert.match(nativeMethod(session, "Encourage"), /_encouragement\.Next\(\)/);
  assert.doesNotMatch(nativeMethod(session, "Encourage"), /new\s+EncouragementProvider/);
  assert.match(nativeMethod(packageSource, "Cheer"), /PartySession\.Instance\.Encourage\(\)/);
  assert.doesNotMatch(host + packageSource, /new\s+EncouragementProvider/);
  const message = nativeMethod(host, "MessageReceived");
  assert.match(message, /DuplicatePropertyNameHandling\s*=\s*DuplicatePropertyNameHandling\.Error/);
  assert.match(message, /if\s*\(payload\["command"\]\?\.Type\s*!=\s*JTokenType\.String\)\s*\{[^}]*RejectMessage\([^;]+;\s*return\s*;/);
  const guard = /if\s*\(payload\.Properties\(\)\.Count\(\)\s*!=\s*1\)\s*\{[^}]*RejectMessage\([^;]+;\s*return\s*;\s*\}/.exec(message);
  assert.ok(guard, "Non-monkey commands must reject extra fields before dispatch");
  const dispatchIndex = message.indexOf("switch (command)");
  assert.ok(dispatchIndex > guard.index + guard[0].length);
  const dispatch = message.slice(dispatchIndex);
  for (const command of ["ready", "start", "pause", "restore", "more", "encourage"]) assert.ok(dispatch.includes(`case "${command}":`));
  const encourage = /case\s+"encourage":([\s\S]*?)break\s*;/.exec(dispatch)?.[1];
  assert.ok(encourage);
  assert.match(encourage, /ready\s*&&\s*loaded\s*&&\s*IsVisible/);
  assert.match(encourage, /type\s*=\s*"encouragement",\s*text\s*=\s*PartySession\.Instance\.Encourage\(\)/);
  assert.match(dispatch, /default:\s*RejectMessage\(/);
  const monkey = message.slice(message.indexOf('if (command == "monkey")'), guard.index);
  assert.match(monkey, /payload\.Properties\(\)\.Count\(\)\s*!=\s*2\s*\|\|\s*payload\["monkey"\]\?\.Type\s*!=\s*JTokenType\.String/);
  assert.match(monkey, /monkey\s+is\s+"brown"\s+or\s+"black-and-white"\s+or\s+"golden"/);
  assert.match(monkey, /PartySession\.Instance\.SelectMonkey\(monkey\)/);
  assert.match(monkey, /return\s*;\s*\}\s*$/);
});
