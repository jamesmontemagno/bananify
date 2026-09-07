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
};
function argb(value) {
  const hex = value.replace("#", "").toUpperCase();
  return hex.length === 8 ? hex.slice(6) + hex.slice(0, 6) : "FF" + hex;
}
function category(name, colors) {
  return `    <Category Name="${name}" GUID="{${categoryIds[name]}}">\n` +
    Object.entries(colors).map(([token, values]) =>
      `      <Color Name="${token}">\n` +
      Object.entries(values).map(([part, color]) => `        <${part} Type="CT_RAW" Source="${argb(color)}" />`).join("\n") +
      "\n      </Color>").join("\n") + "\n    </Category>";
}
const bg = (color) => ({ Background: color });
const fg = (color) => ({ Foreground: color });
for (const [slug, filename, id] of themes) {
  const theme = require(`../../vscode-extension/themes/${slug}-color-theme.json`);
  const c = theme.colors;
  const light = theme.type === "light";
  const fallback = light ? "de3dbbcd-f642-433c-8353-8f1df4370aba" : "1ded0138-47ce-435e-84ef-9ec1f439b749";
  const syntax = theme.tokenColors.map((token) => token.settings.foreground);
  const environment = {
    ToolWindowBackground: bg(c["sideBar.background"]),
    ToolWindowText: fg(c["sideBar.foreground"]),
    ToolWindowBorder: bg(c["panel.border"]),
    CommandBarGradientBegin: bg(c["sideBar.background"]),
    CommandBarGradientEnd: bg(c["sideBar.background"]),
    CommandBarTextActive: fg(c["sideBar.foreground"]),
    CommandBarTextHover: fg(c["editor.foreground"]),
    CommandBarMenuBackgroundGradientBegin: bg(c["sideBar.background"]),
    CommandBarMenuBackgroundGradientEnd: bg(c["sideBar.background"]),
    CommandBarMenuBorder: bg(c["panel.border"]),
    StatusBarDefault: { Background: c["statusBar.background"], Foreground: c["statusBar.foreground"] },
    EnvironmentBackground: bg(c["activityBar.background"]),
  };
  const editor = {
    "Plain Text": { Background: c["editor.background"], Foreground: c["editor.foreground"] },
    "Selected Text": { Background: c["list.activeSelectionBackground"], Foreground: c["editor.foreground"] },
    "Inactive Selected Text": { Background: c["list.hoverBackground"], Foreground: c["editor.foreground"] },
    "Line Numbers": fg(c["editorLineNumber.foreground"]),
    "Indicator Margin": bg(c["editor.background"]),
    "Comment": fg(syntax[0]),
    "String": fg(syntax[1]),
    "String - Verbatim": fg(syntax[1]),
    "Keyword": fg(syntax[2]),
    "Control Keyword": fg(syntax[2]),
    "Number": fg(syntax[6]),
    "Identifier": fg(syntax[5]),
    "Operator": fg(c["editor.foreground"]),
    "Punctuation": fg(c["editor.foreground"]),
    "User Types": fg(syntax[4]),
    "User Types - Classes": fg(syntax[4]),
    "User Types - Interfaces": fg(syntax[4]),
    "User Types - Enums": fg(syntax[4]),
    "User Types - Structs": fg(syntax[4]),
    "User Types - Delegates": fg(syntax[4]),
    "User Members - Methods": fg(syntax[3]),
    "User Members - Extension Methods": fg(syntax[3]),
    "User Members - Properties": fg(syntax[5]),
    "User Members - Fields": fg(syntax[5]),
    "User Members - Events": fg(syntax[5]),
    "User Members - Parameters": fg(syntax[5]),
    "User Members - Local Variables": fg(syntax[5]),
    "XML Doc Comment": fg(syntax[0]),
    "XML Doc Comment - Delimiter": fg(syntax[0]),
    "XML Doc Comment - Name": fg(syntax[4]),
    "Preprocessor Keyword": fg(syntax[2]),
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
    TextFillTertiary: bg(syntax[0]),
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
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from Bananify's original palettes by scripts/generate-themes.cjs. -->\n<Themes>\n  <Theme Name="${theme.name}" GUID="{${id}}" FallbackId="{${fallback}}">\n` +
    [category("Environment", environment), category("Text Editor", editor), category("Shell", shell), category("ShellInternal", internal)].join("\n") +
    "\n  </Theme>\n</Themes>\n";
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${filename}.vstheme`), xml);
}
