# Bananify for VS Code

Give your editor a harmless banana party. Bananify adds stable banana and illustrated monkey decorations to every visible editor pane, four optional color themes, and a little troop of monkeys in the Activity Bar.

![Bananify showing Sebastian in the Explorer Banana Party alongside banana editor and gutter decorations](https://raw.githubusercontent.com/jamesmontemagno/bananify/main/vscode-extension/media/bananify-vscode-screenshot.png)

## Features

- Run **Bananify: Start or Stop Banana Party** from the Command Palette or click the banana status item.
- Turn the party on for the maximum default density across split editors, with stable
  mixes of bananas, monkey flourishes, and illustrated gutter art. Choose a lower
  density in Settings when you want a quieter party.
- Open the Bananify Activity Bar panel to meet Mooch, Sebastian, and Henry, choose a pal, or ask for encouragement.
- Hover over banana or monkey editor decorations for encouragement from your selected pal.
- Enable **Bananify: File Badges** in Settings to add banana badges to workspace files
  currently visible in text editors. Badges disappear when you stop the
  party, and never spread to folders or change file colors. VS Code controls how
  they appear alongside Git and other extension badges.
- Expand the compact **Banana Party** section in Explorer for a three-monkey troop
  beside your files, or run **Bananify: Open Banana Party Editor Tab** for the
  larger version with its own banana tab icon. Both are opt-in, share start/stop state, use bounded falling
  bananas, and burst a small illustrated bunch wherever you click or tap inside the
  view. The banana-level control cycles from **1 banana** through **5 bananas** and also spawns a bunch with the keyboard. Bursts stay inside
  the view, respect reduced motion, and stop with the party.
- Run **Bananify: Choose Banana Theme** to preview Banana Grove, Banana Cream, Midnight Banana, or Monkey Jungle. Each theme colors VS Code's classic and modern framed layouts, including the Command Center, Secondary Side Bar, panels, tabs, menus, notifications, and focus states. Bananify never changes your theme automatically.
- Run **Start or Stop Banana Party** again to remove decorations, stop status animation, and close the Party tab. Source files are never modified.

The extension performs no network requests and does not collect telemetry.

Banana text decorations use supported editor decorations. Illustrated monkeys use the
editor gutter and therefore share that space with native editor features such as
breakpoints. Bananify does not claim priority over those features.

### A smaller Explorer party

The Explorer view uses a miniature troop, smaller falling bananas, and compact
controls so more room is left for your files. VS Code controls the pane's outer
height: drag the **Banana Party** divider to resize it, or collapse the view.
The editor Party tab keeps its larger layout.

### Themes in the Agents window

All four themes are available in the Agents window in current VS Code Insiders
builds that honor extension-declared Agents window support. Open **Preferences:
Color Theme** in that window and select Banana Grove, Banana Cream, Midnight
Banana, or Monkey Jungle. Installing Bananify never selects a theme for you.
The Activity Bar, Explorer party view, and status item are editor-window features;
the Agents window does not provide those surfaces.

Bananify includes executable party features as well as themes. Without an
explicit compatibility declaration, VS Code disables the entire extension in the
Agents window, including its declarative themes. Bananify now declares that
compatibility without requiring proposed APIs.

Older builds, including VS Code 1.141.2, do not yet honor that declaration for
Marketplace extensions. Update to a build that supports it, or explicitly enable
Bananify in your **User Settings (JSON)** and reload the Agents window:

```json
"extensions.supportAgentsWindow": {
  "vs-publisher-473885.bananify": true
}
```

Merge this entry with any existing entries in that setting. On newer builds,
also check that `extensions.experimental.enableAgentsWindowCapability` has not
been disabled and that Bananify has not been explicitly disabled for the Agents
window. Bananify does not change these settings automatically.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `bananify.decorations.enabled` | `false` | Show banana editor decorations. |
| `bananify.decorations.density` | `5` | Choose a decoration level from 1 to 5; parties start at full intensity. |
| `bananify.monkey` | `brown` | Choose the monkey shown in the panel. |
| `bananify.fileBadges.enabled` | `false` | Add Explorer banana badges to visible workspace files while the party is active. |
| `bananify.reducedMotion` | `false` | Reduce native status/sidebar motion; webviews also honor the system preference. |
| `bananify.celebrations.onSave` | `false` | Briefly celebrate saves on visible Bananify surfaces. |
| `bananify.celebrations.onSuccessfulTask` | `false` | Briefly celebrate tasks that exit with code 0. |

Celebrations are disabled by default, globally rate-limited, and never open or focus a
view. Hidden webviews do not run animation loops.

## Development

Use Node.js 22 or newer.

```sh
npm ci
npm run lint
npm run check
npm test
npm run test:smoke
npm run test:smoke:agents
npm run package
```

The standard smoke test runs against the minimum supported VS Code version.
The Agents smoke test uses current Insiders and an isolated profile, without a
per-extension enablement override. Set `VSCODE_EXECUTABLE_PATH` to test an
already-installed VS Code executable instead of downloading one.

Press **F5** from this directory in VS Code to launch an Extension Development Host.

## Privacy

Bananify reads only the visible document lines needed to place decorations. It does not change files, open network connections, track usage, or send code anywhere.

## License

[MIT](LICENSE)
