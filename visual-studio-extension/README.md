# Bananify for Visual Studio

A native Visual Studio 2026 companion to Bananify: banana and monkey editor decorations, a local party with Mooch, Sebastian and Henry, four optional full-IDE themes, and opt-in Solution Explorer badges for SDK-style C# and VB projects.

**Development status:** the extension is not yet release-qualified. Reference compilation and portable tests do not establish runtime compatibility. A Windows Visual Studio 2026 experimental-instance run is required, especially for dynamic project-tree badge refresh, theme registration and WebView2 lifetime. The Windows CI workflow builds and inspects the VSIX; it is explicitly not a VS2026 UI test.

## The party

Use **Tools > Bananify** to toggle decorations, change density, pause/resume, restore the editor, open either party window, or open settings. The compact window can dock alongside your tools; the larger party is registered for the document area. Visual Studio retains the layout you choose.

Decorations never edit source text, dirty a document or add undo records. Illustrated gutter art uses a separate margin, not the breakpoint glyph margin. Very long lines omit EOL artwork when there is insufficient viewport space.

**Pause** removes native decorations and badges while pausing the party. **Restore Editor** stops the party and hides its larger native window. Starting a new IDE session restores the enabled preference but not a transient paused state. **More Bananas** cycles density from 1 through 5 and back to 1; the party's burst control remains bounded.

Both **Monkey Business** and **Banana Party** show the current **Banana level: N/5**, synchronized with settings and commands. Rain falls in front of the monkeys without intercepting clicks or obscuring the action buttons and messages.

Use **Encourage me** in either panel for an inline phrase from the selected monkey, or **Tools > Bananify > Ask a Monkey for Encouragement** for a dialog. Both share 40 local phrases and avoid consecutive repeats. Encouragement works while paused or disabled and never starts decorations. Messages remain through unrelated state/theme updates; another message, a change of monkey, Start/Pause/Restore, or a visibility change replaces or clears them.

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
| Celebrate completed saves | Off | Shows **Save completed!** feedback after a document has saved in a visible party panel. |
| Celebrate successful solution builds | Off | Shows **Build succeeded!** feedback; ignores failed/canceled builds and clean-only operations. |

Automatic celebrations require an active, unpaused party and a visible **Monkey Business** or **Banana Party** panel. They share a five-second cooldown and never open or focus a window. Hidden panels do not replay missed celebrations. A save just before a build can consume the shared cooldown, so a fast build may not produce a second celebration. With motion enabled, feedback includes a brief banana burst and monkey bounce; reduced motion and high contrast use readable text without movement. **More bananas** has its own manual feedback and does not consume the automatic cooldown. No audio, typing capture, usage tracking or all-tests-passed inference is included.

To check celebrations in a VS2026 experimental instance:

1. Choose **Tools > Bananify > Open Banana Party** to open **Monkey Business**, keep it visible, and ensure the party is not paused. Enable both celebration settings in **Tools > Options > Bananify > General**.
2. Edit a source file and save it. Look for **Save completed!** in the panel; an unchanged file may not trigger a completed-save event.
3. Wait more than five seconds, then build an already-saved project/solution that actually performs a build. Look for **Build succeeded!**. Avoid a pre-build save inside the cooldown when checking this separately.
4. Repeat with **Reduce motion** enabled: messages still appear, but particles and bounce do not. Pause or hide the panel to check suppression; restoring visibility must not replay an old event.
5. Check a failed build, a canceled build, and a clean-only operation: none should announce build success. Verify that rapid saves/builds share the cooldown.

The native save listener exposes the documented `IVsRunningDocTableEvents3` fallback for modern RDT save notifications. Browser and core tests verify message handling and cooldown logic, not actual Visual Studio callback delivery.

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

Pushing a **`visualstudio-vX.Y.Z`** tag runs the build, tests, and package inspection, then **publishes publicly** to the Visual Studio Marketplace and attaches the same VSIX to a GitHub release. Tags and listing identity are separate from the VS Code product. Branch pushes, pull requests, and manual workflow runs only build and validate; they do not publish.

Before pushing a release tag:

1. Complete the Windows release checklist above and review the Marketplace overview/screenshots. A tag is the maintainer's release decision; CI does not automate the VS2026 UI checks.
2. Set `Identity.Version` in `src/Bananify/source.extension.vsixmanifest` and `Version` in `Directory.Build.props` to the same release version. Keep the About-box version in `BananifyPackage.cs` current as well. Commit the changes and tag that commit, normally after merging it to `main`.
3. Use an exact matching tag, for example **`visualstudio-v0.1.1`** for version **`0.1.1`**. Three or four numeric components are supported, without leading zeros or prerelease/build suffixes. CI validates the source before building and checks the version inside the built and downloaded VSIX. It fails on mismatches instead of silently stamping another version.
4. Ensure the existing **`VSCE_PAT`** repository secret (or fallback **`VSCE_TOKEN`**) is available to this workflow. It must have **Marketplace > Manage** scope and publishing access to **`vs-publisher-473885`**. This reuses the VS Code pipeline's secret names; do not put tokens in source or logs. No Open VSX publishing is performed for this Visual Studio extension.
5. Push the tag. Only a successful build permits the publish job to download and recheck the tested artifact, upload it with the overview/screenshots, and create the GitHub release. The publish job does not rebuild the package. The release uses `make_latest: false` so it does not replace the repository's main product release.

Run `node visual-studio-extension/scripts/release-version.cjs` locally to check committed versions. Set the `RELEASE_TAG` environment variable to the intended tag to check the match, and use `Verify-Vsix.ps1 -Path <file.vsix> -ReleaseTag <tag>` to validate an actual artifact (Node.js is required for the tag check). Run the release regressions with `node --test visual-studio-extension/tests/release.test.mjs`.

Do not move or reuse a published version tag for different code. Use a higher version for updates. If publishing fails, inspect the job logs and Marketplace state before retrying; uploading an existing version can overwrite it. Protect the `visualstudio-v*` tag namespace with repository rules as appropriate. If signing is used, follow Microsoft's current Sign CLI guidance rather than deprecated VSIXSignTool instructions and ensure the signed artifact is the one inspected and published. Keep signing/publisher credentials outside source control.

### Marketplace overview and screenshots

The user-facing listing is [docs/visual-studio-marketplace.md](../docs/visual-studio-marketplace.md), separate from this development README. It includes the original [Visual Studio screenshot](../docs/visual-studio-extension.png). The short description and tags come from `src/Bananify/source.extension.vsixmanifest`.

[`vs-publish.json`](vs-publish.json) follows the same overview/assetFiles pattern as [FileView](https://github.com/madskristensen/FileView): `overview` points to the Markdown file, and `assetFiles` uploads the local screenshot under the name used by its Markdown image link. The paths on disk are relative to the publishing manifest. These are Marketplace assets, not documentation installed inside the VSIX; uploading only the VSIX does not automatically upload this overview.

To add another screenshot, put it beside the overview in `docs`, reference its filename in the Markdown, and add a matching `assetFiles` entry with `pathOnDisk` set to `../docs/<filename>` and `targetPath` set to `<filename>`. Run `node --test visual-studio-extension/tests/package.test.mjs` from the repository root to check the listing and image mappings.

The configured publisher ID is `vs-publisher-473885`, and the proposed internal listing name is `Bananify.VisualStudio`, separate from the VS Code product. Before the first upload, confirm that name; if updating an existing Visual Studio listing, use its existing internal name instead. Preserve the VSIX identity and use the appropriate next release version for an update.

The manifest uses **`private: false`**: release-tag uploads are public. The publishing job restores the project's pinned `Microsoft.VSSDK.BuildTools` package (without rebuilding), locates its `VsixPublisher.exe` through NuGet's assets file, and passes the inspected VSIX as `-payload` and this manifest as `-publishManifest`, running from `visual-studio-extension`. See Microsoft's [publishing guide](https://learn.microsoft.com/visualstudio/extensibility/walkthrough-publishing-a-visual-studio-extension-via-command-line) for authentication and manual recovery options. Local builds and tests never invoke a publish operation.

Bananify uses bundled artwork and local party assets, exposes no general file/shell API to the party, and does not collect telemetry or upload code. Preferences live in Visual Studio's per-user settings store. WebView2 data lives beneath the owning IDE's local data directory, keeping experimental and normal IDE roots separate. WebView2 has its own browser data/runtime lifecycle; the extension's local-only behavior is not a promise about all Microsoft runtime/updater processes.

Original artwork and code are [MIT licensed](../LICENSE). Existing browser and VS Code extensions remain separate products and build paths.
