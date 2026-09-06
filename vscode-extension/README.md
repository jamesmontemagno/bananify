# Bananify for Visual Studio Code

Give your editor a harmless banana party. Bananify adds stable banana decorations to visible files, an optional **Banana Grove** color theme, and a little troop of monkeys in the Activity Bar.

## Features

- Run **Bananify: Toggle Banana Party** from the Command Palette or click the banana status item.
- Use **More Bananas** to cycle through five decoration levels.
- Open the Bananify Activity Bar panel to meet Mochi, Pepper, and Sunny, choose a pal, or ask for encouragement.
- Run **Bananify: Choose Banana Theme** to preview and optionally select Banana Grove. Bananify never changes your theme automatically.
- Run **Restore Editor** to remove every decoration. Source files are never modified.

The extension performs no network requests and does not collect telemetry.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `bananify.decorations.enabled` | `false` | Show banana editor decorations. |
| `bananify.decorations.density` | `2` | Choose a decoration level from 1 to 5. |
| `bananify.monkey` | `brown` | Choose the monkey shown in the panel. |

## Development

Use Node.js 22 or newer.

```sh
npm ci
npm run check
npm test
npm run package
```

Press **F5** from this directory in VS Code to launch an Extension Development Host.

## Privacy

Bananify reads only the visible document lines needed to place decorations. It does not change files, open network connections, track usage, or send code anywhere.

## License

[MIT](../LICENSE)
