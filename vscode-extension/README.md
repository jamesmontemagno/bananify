# Bananify for Visual Studio Code

Give your editor a harmless banana party. Bananify adds stable banana and illustrated monkey decorations to every visible editor pane, four optional color themes, and a little troop of monkeys in the Activity Bar.

![Bananify showing Sebastian in the Explorer Banana Party alongside banana editor and gutter decorations](https://raw.githubusercontent.com/jamesmontemagno/bananify/main/vscode-extension/media/bananify-vscode-screenshot.png)

## Features

- Run **Bananify: Toggle Banana Party** from the Command Palette or click the banana status item.
- Turn the party on for the maximum default density across split editors, with stable
  mixes of bananas, monkey flourishes, and illustrated gutter art. Choose a lower
  density in Settings when you want a quieter party.
- Open the Bananify Activity Bar panel to meet Mooch, Sebastian, and Henry, choose a pal, or ask for encouragement.
- Hover over banana or monkey editor decorations for encouragement from your selected pal.
- Enable **Bananify: File Badges** in Settings to add banana badges to workspace files
  currently visible in text editors. Badges disappear when you pause or restore the
  party, and never spread to folders or change file colors. VS Code controls how
  they appear alongside Git and other extension badges.
- Expand the compact **Banana Party** section in Explorer for a three-monkey troop
  beside your files, or run **Bananify: Open Banana Party Editor Tab** for the
  larger version with its own banana tab icon. Both are opt-in, share pause/stop state, use bounded falling
  bananas, and burst a small illustrated bunch wherever you click or tap inside the
  view. **More bananas** also spawns a bunch with the keyboard. Bursts stay inside
  the view, respect reduced motion, and stop while the party is paused.
- Run **Bananify: Choose Banana Theme** to preview Banana Grove, Banana Cream, Midnight Banana, or Monkey Jungle. Bananify never changes your theme automatically.
- Run **Restore Editor** to remove decorations, stop status animation, and close the Party tab. Source files are never modified.

The extension performs no network requests and does not collect telemetry.

Banana text decorations use supported editor decorations. Illustrated monkeys use the
editor gutter and therefore share that space with native editor features such as
breakpoints. Bananify does not claim priority over those features.

### A smaller Explorer party

The Explorer view uses a miniature troop, smaller falling bananas, and compact
controls so more room is left for your files. VS Code controls the pane's outer
height: drag the **Banana Party** divider to resize it, or collapse the view.
The editor Party tab keeps its larger layout.

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
npm run package
```

Press **F5** from this directory in VS Code to launch an Extension Development Host.

## Privacy

Bananify reads only the visible document lines needed to place decorations. It does not change files, open network connections, track usage, or send code anywhere.

## License

[MIT](LICENSE)
