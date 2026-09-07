# Bananify for Visual Studio

A native Visual Studio 2026 companion to Bananify: banana and monkey editor decorations, a local party with Mooch, Sebastian and Henry, four optional full-IDE themes, and opt-in Solution Explorer badges for SDK-style C# and VB projects.

**Development status:** the extension is not yet release-qualified. Reference compilation and portable tests do not establish runtime compatibility. A Windows Visual Studio 2026 experimental-instance run is required, especially for dynamic project-tree badge refresh, theme registration and WebView2 lifetime. The Windows CI workflow builds and inspects the VSIX; it is explicitly not a VS2026 UI test.

## The party

Use **Tools > Bananify** to toggle decorations, change density, pause/resume, restore the editor, open either party window, or open settings. The compact window can dock alongside your tools; the larger party is registered for the document area. Visual Studio retains the layout you choose.

Decorations never edit source text, dirty a document or add undo records. Illustrated gutter art uses a separate margin, not the breakpoint glyph margin. Very long lines omit EOL artwork when there is insufficient viewport space.

**Pause** removes native decorations and badges while pausing the party. **Restore Editor** stops the party and hides its larger native window. Starting a new IDE session restores the enabled preference but not a transient paused state. **More Bananas** cycles density from 1 through 5 and back to 1; the party's burst control remains bounded.

Choose **Banana Grove**, **Banana Cream**, **Midnight Banana**, or **Monkey Jungle** through Visual Studio's theme settings. Installing or starting Bananify never changes the selected theme. Restoring the editor does not undo a theme you deliberately selected.

## Settings

Open **Tools > Options > Bananify > General**.

| Setting | Default | Behavior |
| --- | --- | --- |
| Enable decorations | Off | Applies to eligible visible editable source views, including splits. |
| Density | 5 | Accepts 1-5. |
| Monkey | `brown` | `brown` (Mooch), `black-and-white` (Sebastian), `golden` (Henry). |
| Reduce motion | Off | Windows animation settings and high contrast also disable party motion. |
| Enable file badges | Off | Visible editor files in supported SDK-style C#/VB project trees only. |
| Celebrate completed saves | Off | A brief celebration on existing party surfaces. |
| Celebrate successful solution builds | Off | Ignores failed/canceled builds and clean-only operations. |

Automatic celebrations require an active, unpaused party, share a five-second cooldown, and never open or focus a window. No audio, typing capture, usage tracking or all-tests-passed inference is included.

### Badge support boundary

The initial badge contract covers SDK-style C# and VB projects. C++, F#, legacy managed projects, miscellaneous files and Open Folder are not advertised. Existing icons outside the supported capability scope must remain untouched. Within scope, linked files, original file-type imagery, Git/status indicators, rename, split-view visibility and restoration are mandatory runtime checks, not assumptions.

The adapter uses CPS's physical-tree provider and image-service composition, not global file-icon replacement. It requires absolute `FullPath` item metadata; unavailable metadata is logged and the original node is left untouched rather than guessing from a caption. Runtime availability of that metadata and actual icon recalculation on CPS refresh remain release blockers. Density/character changes and disabled badges do not request unnecessary tree refreshes.

## Development

The core targets .NET Standard 2.0; its tests use .NET 10. The native host targets .NET Framework 4.8. Exact package versions are pinned in project files.

On macOS or Windows with .NET 10 and Node.js 22+:

```sh
dotnet test visual-studio-extension/tests/Bananify.Core.Tests/Bananify.Core.Tests.csproj
node --test visual-studio-extension/tests/package.test.mjs
node visual-studio-extension/scripts/check-generated.cjs
dotnet build visual-studio-extension/src/Bananify/Bananify.csproj
```

The last command on macOS is a reference-only compile. Packaging tasks are intentionally Windows-only. It does not produce a usable VSIX or exercise WPF, COM services, WebView2 or CPS.

The local party browser tests use the repository's existing Playwright dependency:

```sh
npm ci
npx playwright install chromium
node --test visual-studio-extension/scripts/party.test.mjs
```

Artwork and themes are committed generated assets. After changing the original VS Code artwork/palettes or the party HTML template, run `node visual-studio-extension/scripts/generate-assets.cjs` and `node visual-studio-extension/scripts/generate-themes.cjs`, then review the generated changes. CI rejects stale generated assets.

On Windows, install Visual Studio 2026 with **Visual Studio extension development**, the .NET Framework 4.8 targeting/desktop components, .NET 10 SDK and Node.js. In a Visual Studio developer shell:

```powershell
msbuild visual-studio-extension/src/Bananify/Bananify.csproj /restore /t:Rebuild /p:Configuration=Release /p:DeployExtension=false /p:VsixDeployOnDebug=false
```

Inspect the resulting VSIX with `visual-studio-extension/Verify-Vsix.ps1 -Path <file.vsix>`. Use a VS experimental instance, not your everyday IDE profile. If using IDE launch settings, configure the extension's debug executable to the actual VS2026 `devenv.exe` and `/RootSuffix Exp`; do not assume a hard-coded install path.

The manifest's `[17.14,)` is an **API requirement**, not a claim that VS2022 has been tested. VS2026 supports 17.x API compatibility and ignores the old upper-bound convention. AMD64 and ARM64 are declared package targets; both require runtime qualification before advertising a release.

## Required Windows release checklist

Open `tests/Fixtures/BadgeFixture.sln` inside the VS2026 experimental instance for SDK-style C#/VB and linked-file exercises. Open each normal and linked source file, split a view, switch tabs, pause, restore and close the last visible view while observing Solution Explorer. The fixture is a reproducible scenario, not evidence the badges have already passed.

1. Install/uninstall/update the actual packaged VSIX in VS2026; verify commands, package and MEF discovery.
2. Verify decorations across C#/VB, split/floating views, wrap/folding/zoom, long lines, CodeLens and mixed DPI without input or breakpoint interference.
3. Confirm source snapshots, dirty flags, selections and undo stacks remain unchanged after Start/More/Pause/Restore.
4. Confirm SDK-style C#/VB badges preserve base icons and Git overlays, refresh on view membership/rename/settings changes, and restore without project reload or source-file writes.
5. Install and switch among all four themes; check shell, menus, tool windows, Solution Explorer, tabs, editor classifications, diagnostic colors and high contrast. No automatic selection.
6. Exercise compact/large party hosts, keyboard controls, hidden windows, reduced motion, browser initialization failure, repeated close/reopen and IDE shutdown.
7. Exercise save-all, successful/failed/canceled multi-project builds and clean-only operations; verify cooldown and no focus stealing.
8. Profile enabled/disabled typing/scrolling and retained view/browser memory after closing windows. Verify bounded particles and no hidden animation.
9. Validate each advertised host architecture and no extension-initiated external requests.

## Distribution and privacy

`.github/workflows/visual-studio.yml` is independent of the browser and VS Code pipelines. Its `windows-2022` build image supplies Windows MSBuild; this is not a claim the image runs VS2026. A green package build cannot satisfy the experimental-instance checklist.

No Marketplace publication or release upload is automated here. After runtime qualification, prepare a **Visual Studio** Marketplace listing (not VS Code), use an independent version/tag namespace such as `visualstudio-v0.1.0`, and publish the exact inspected artifact. If signing is used, follow Microsoft's current Sign CLI guidance rather than deprecated VSIXSignTool instructions. Keep signing/publisher credentials outside source control.

Bananify uses bundled artwork and local party assets, exposes no general file/shell API to the party, and does not collect telemetry or upload code. Preferences live in Visual Studio's per-user settings store. WebView2 data lives beneath the owning IDE's local data directory, keeping experimental and normal IDE roots separate. WebView2 has its own browser data/runtime lifecycle; the extension's local-only behavior is not a promise about all Microsoft runtime/updater processes.

Original artwork and code are [MIT licensed](../LICENSE). Existing browser and VS Code extensions remain separate products and build paths.
