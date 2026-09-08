"use strict";

const fs = require("node:fs");
const path = require("node:path");
const directory = path.resolve(__dirname, "../src/Bananify/Themes");
const themes = [
  ["banana-grove", "BananaGrove", "9d569ac6-ea15-45ec-9ab9-5663fa8d3b63"],
  ["banana-cream", "BananaCream", "67f82e36-25f5-4de5-9bfd-d1875a01f387"],
  ["midnight-banana", "MidnightBanana", "08108a81-5cc0-4332-a19b-e9a1ac650094"],
  ["monkey-jungle", "MonkeyJungle", "cd7ccac6-92f7-45d3-b7c8-f3c04d6d944d"],
];
const categoryIds = {
  Environment: "624ed9c3-bdfd-41fa-96c3-7c824ea32e3d",
  "Text Editor": "a27b4e24-a735-4d1d-b8e7-9716e1e3d8e0",
  Shell: "73708ded-2d56-4aad-b8eb-73b20d3f4bff",
  ShellInternal: "5af241b7-5627-4d12-bfb1-2b67d11127d7",
  TreeView: "92ecf08e-8b13-4cf4-99e9-ae2692382185",
};
function argb(value) {
  const hex = value.replace("#", "").toUpperCase();
  return hex.length === 8 ? hex.slice(6) + hex.slice(0, 6) : "FF" + hex;
}
function scopeForeground(theme, scope) {
  let color = theme.colors["editor.foreground"];
  for (const token of theme.tokenColors) {
    const scopes = Array.isArray(token.scope) ? token.scope : (token.scope || "").split(",").map((value) => value.trim());
    if (scopes.includes(scope) && token.settings.foreground) {
      color = token.settings.foreground;
    }
  }
  return color;
}
function opaqueSelection(color, background) {
  if (color.length !== 9) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  return "#" + [1, 3, 5].map((offset) => {
    const front = parseInt(color.slice(offset, offset + 2), 16);
    const back = parseInt(background.slice(offset, offset + 2), 16);
    return Math.round(front * alpha + back * (1 - alpha)).toString(16).padStart(2, "0");
  }).join("");
}
function category(name, colors) {
  return `    <Category Name="${name}" GUID="{${categoryIds[name]}}">\n` +
    Object.entries(colors).map(([token, values]) =>
      `      <Color Name="${token}">\n` +
      Object.entries(values).map(([part, color]) => `        <${part} Type="CT_RAW" Source="${argb(color)}" />`).join("\n") +
      "\n      </Color>").join("\n") + "\n    </Category>";
}
function readableMuted(color, background, foreground) {
  const rgb = (value) => [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const luminance = (value) => rgb(value).map((channel) => {
    const s = channel / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
  const base = luminance(background);
  const contrast = (value) => (Math.max(base, luminance(value)) + .05) / (Math.min(base, luminance(value)) + .05);
  const start = rgb(color);
  const target = rgb(foreground);
  let result = color;
  for (let step = 1; step <= 20 && contrast(result) < 4.5; step++) {
    result = "#" + start.map((channel, i) => Math.round(channel + (target[i] - channel) * step / 20).toString(16).padStart(2, "0")).join("");
  }
  return result;
}
const bg = (color) => ({ Background: color });
const fg = (color) => ({ Foreground: color });
for (const [slug, filename, id] of themes) {
  const theme = require(`../../vscode-extension/themes/${slug}-color-theme.json`);
  const c = theme.colors;
  const light = theme.type === "light";
  const fallback = light ? "de3dbbcd-f642-433c-8353-8f1df4370aba" : "1ded0138-47ce-435e-84ef-9ec1f439b749";
  const syntax = {
    comment: scopeForeground(theme, "comment"),
    string: scopeForeground(theme, "string"),
    keyword: scopeForeground(theme, "keyword"),
    function: scopeForeground(theme, "entity.name.function"),
    type: scopeForeground(theme, "entity.name.type"),
    variable: scopeForeground(theme, "variable"),
    number: scopeForeground(theme, "constant.numeric"),
  };
  // VS2026 Environment text keys use Background; menu hover is a Background/Foreground pair.
  const environment = {
    ToolWindowBackground: bg(c["sideBar.background"]),
    ToolWindowText: bg(c["sideBar.foreground"]),
    ToolWindowBorder: bg(c["panel.border"]),
    CommandBarGradientBegin: bg(c["sideBar.background"]),
    CommandBarGradientEnd: bg(c["sideBar.background"]),
    CommandBarTextActive: bg(c["sideBar.foreground"]),
    CommandBarTextHover: bg(c["editor.foreground"]),
    CommandBarMouseOverBackgroundBegin: bg(c["list.hoverBackground"]),
    CommandBarMouseOverBackgroundEnd: bg(c["list.hoverBackground"]),
    CommandBarMenuBackgroundGradientBegin: bg(c["sideBar.background"]),
    CommandBarMenuBackgroundGradientEnd: bg(c["sideBar.background"]),
    CommandBarMenuBorder: bg(c["panel.border"]),
    CommandBarMenuIconBackground: bg(c["sideBar.background"]),
    CommandBarMenuSeparator: bg(c["panel.border"]),
    CommandBarMenuItemMouseOver: { Background: c["list.hoverBackground"], Foreground: c["editor.foreground"] },
    FileTabBackground: bg(c["tab.inactiveBackground"]),
    FileTabBorder: bg(c["tab.inactiveBackground"]),
    FileTabText: bg(c["sideBar.foreground"]),
    FileTabSelectedGradientTop: bg(c["tab.activeBackground"]),
    FileTabSelectedGradientBottom: bg(c["tab.activeBackground"]),
    FileTabSelectedBorder: bg(c["tab.activeBackground"]),
    FileTabSelectedText: bg(c["editor.foreground"]),
    FileTabDocumentBorderBackground: bg(c["tab.activeBorderTop"]),
    FileTabInactiveGradientTop: bg(c["tab.inactiveBackground"]),
    FileTabInactiveGradientBottom: bg(c["tab.inactiveBackground"]),
    FileTabInactiveBorder: bg(c["tab.inactiveBackground"]),
    FileTabInactiveText: bg(c["sideBar.foreground"]),
    FileTabHotGradientTop: bg(c["list.hoverBackground"]),
    FileTabHotGradientBottom: bg(c["list.hoverBackground"]),
    FileTabHotBorder: bg(c["list.hoverBackground"]),
    FileTabHotText: bg(c["editor.foreground"]),
    StatusBarDefault: { Background: c["statusBar.background"], Foreground: c["statusBar.foreground"] },
    EnvironmentBackground: bg(c["activityBar.background"]),
  };
  const editor = {
    "Plain Text": { Background: c["editor.background"], Foreground: c["editor.foreground"] },
    "Selected Text": { Background: opaqueSelection(c["editor.selectionBackground"], c["editor.background"]), Foreground: c["editor.foreground"] },
    "Inactive Selected Text": { Background: c["list.hoverBackground"], Foreground: c["editor.foreground"] },
    "Line Number": fg(readableMuted(c["editorLineNumber.foreground"], c["editor.background"], c["editor.foreground"])),
    "Selected Line Number": fg(c["editorLineNumber.activeForeground"]),
    "Indicator Margin": bg(c["editor.background"]),
    "Comment": fg(syntax.comment),
    "String": fg(syntax.string),
    "String - Verbatim": fg(syntax.string),
    "Keyword": fg(syntax.keyword),
    "Control Keyword": fg(syntax.keyword),
    "Number": fg(syntax.number),
    "Identifier": fg(syntax.variable),
    "Operator": fg(c["editor.foreground"]),
    "Punctuation": fg(c["editor.foreground"]),
    "User Types": fg(syntax.type),
    "User Types - Classes": fg(syntax.type),
    "User Types - Interfaces": fg(syntax.type),
    "User Types - Enums": fg(syntax.type),
    "User Types - Structs": fg(syntax.type),
    "User Types - Delegates": fg(syntax.type),
    "User Members - Methods": fg(syntax.function),
    "User Members - Extension Methods": fg(syntax.function),
    "User Members - Properties": fg(syntax.variable),
    "User Members - Fields": fg(syntax.variable),
    "User Members - Events": fg(syntax.variable),
    "User Members - Parameters": fg(syntax.variable),
    "User Members - Local Variables": fg(syntax.variable),
    "XML Doc Comment": fg(syntax.comment),
    "XML Doc Comment - Delimiter": fg(syntax.comment),
    "XML Doc Comment - Name": fg(syntax.type),
    "Preprocessor Keyword": fg(syntax.keyword),
  };
  const accent = c["focusBorder"];
  const shell = {
    AccentFillDefault: bg(accent),
    AccentFillSecondary: bg(accent + "E5"),
    AccentFillTertiary: bg(accent + "CC"),
    TextOnAccentFillPrimary: bg(light ? "#FFFFFF" : c["editor.background"]),
    SolidBackgroundFillBase: bg(c["editor.background"]),
    SolidBackgroundFillSecondary: bg(c["sideBar.background"]),
    SolidBackgroundFillTertiary: bg(c["sideBar.background"]),
    SolidBackgroundFillQuaternary: bg(c["list.hoverBackground"]),
    SurfaceBackgroundFillDefault: bg(c["sideBar.background"]),
    TextFillPrimary: bg(c["editor.foreground"]),
    TextFillSecondary: bg(c["sideBar.foreground"]),
    TextFillTertiary: bg(syntax.comment),
    ControlFillDefault: bg(c["sideBar.background"]),
    ControlFillSecondary: bg(c["list.hoverBackground"]),
    ControlFillTertiary: bg(c["list.activeSelectionBackground"]),
    ControlStrokeDefault: bg(c["panel.border"]),
  };
  const internal = {
    EnvironmentHeader: bg(c["activityBar.background"]),
    EnvironmentTab: bg(c["tab.activeBackground"]),
    EnvironmentBody: bg(c["sideBar.background"]),
    EnvironmentBodyText: bg(c["sideBar.foreground"]),
    EnvironmentBackground: bg(c["activityBar.background"]),
    EnvironmentHeaderInactive: bg(c["tab.inactiveBackground"]),
    EnvironmentTabInactive: bg(c["tab.inactiveBackground"]),
    StatusBarBackgroundFillRest: bg(c["statusBar.background"]),
    EnvironmentBorder: bg(c["panel.border"]),
    EnvironmentIndicator: bg(accent),
    EnvironmentLogo: bg(c["activityBar.foreground"]),
    EnvironmentLayeredBackground: bg(c["sideBar.background"]),
  };
  const tree = {
    Background: { Background: c["sideBar.background"], Foreground: c["sideBar.foreground"] },
    SelectedItemActive: { Background: c["list.activeSelectionBackground"], Foreground: c["sideBar.foreground"] },
    SelectedItemInactive: { Background: c["list.hoverBackground"], Foreground: c["sideBar.foreground"] },
    Glyph: bg(c["sideBar.foreground"]),
    GlyphMouseOver: bg(c["sideBar.foreground"]),
    SelectedItemActiveGlyph: bg(c["sideBar.foreground"]),
    SelectedItemActiveGlyphMouseOver: bg(c["sideBar.foreground"]),
    SelectedItemInactiveGlyph: bg(c["sideBar.foreground"]),
    SelectedItemInactiveGlyphMouseOver: bg(c["sideBar.foreground"]),
    FocusVisualBorder: bg(accent),
  };
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from Bananify's original palettes by scripts/generate-themes.cjs. -->\n<Themes>\n  <Theme Name="${theme.name}" GUID="{${id}}" FallbackId="{${fallback}}">\n` +
    [category("Environment", environment), category("Text Editor", editor), category("Shell", shell), category("ShellInternal", internal), category("TreeView", tree)].join("\n") +
    "\n  </Theme>\n</Themes>\n";
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${filename}.vstheme`), xml);
}
