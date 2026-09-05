# Bananify

The internet. But bananas. Website: <https://bananify.online>.

A zero-dependency Chrome / Edge extension. Click the banana in your toolbar to cover the current website in bananas and invite a dancing capuchin.

## Install

1. Download the extension ZIP from <https://bananify.online/#install> and extract it.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted `bananify` folder containing `manifest.json` (or this repository's root when developing).
5. Pin **Bananify** from the browser's Extensions menu.
6. Open a regular website and click the banana.

This is a manual install, not a Chrome Web Store or Edge Add-ons listing.

Click again to turn it off, or use **Restore page** in the floating controls. **More bananas** increases the shower; **Pause** freezes the celebration. Clicking the website tosses a little banana confetti without consuming the click.

The party is per-page and resets on navigation or reload. Browser settings, extension stores, and some built-in viewers don't allow extensions to modify them. A `!` badge and toolbar tooltip explain when a page can't be changed.

## Try it locally

With Node.js 22 or newer and the `zip` command (included on macOS and Ubuntu):

```sh
npm start
```

Open <http://127.0.0.1:4173>. This builds and serves the production site, including the extension download. Restart it to rebuild after changes. The preview runs the same artwork and party code as the extension; it does not need to be installed first.

## Behavior and privacy

- Only `activeTab` and `scripting` permissions; no always-on site access.
- The extension makes no network requests and uses no analytics, storage, remote libraries, or audio. The website is hosted by GitHub Pages and loads its own static files.
- Original vector banana and capuchin artwork, bundled locally.
- An isolated Shadow DOM overlay leaves the website's content and styles untouched.
- Only the small party control bar intercepts pointer input.
- Reduced-motion preferences get a static banana party; hidden tabs suspend animation.
- Particle counts are bounded. Removal cancels animation and removes event listeners.
- A website's fullscreen/top-layer dialogs may appear above the party. The extension does not alter those dialogs.

## Development

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run icons
```

The extension has no runtime dependencies or build step. Playwright is a development-only dependency for browser tests. On a Mac with Edge installed, `BROWSER_CHANNEL=msedge npm run test:browser` can use that browser instead of downloading Chromium.

After changing files, reload the extension on the Extensions page and refresh the test website.

`artwork.js` supplies the shared original SVG art. `party.js` owns the overlay and its cleanup. `toggle.js` is the toolbar entry point injected by `background.js`. The HTML/CSS is the public website, not an extension popup.

## CI/CD

`.github/workflows/pages.yml` runs on pull requests, pushes to `main`, and manual dispatches. It checks JavaScript, tests the extension and reproducible ZIP, builds an allowlisted `dist/` directory, and exercises the production site in Chromium at desktop and mobile sizes, including reduced motion, cleanup, and downloads. Screenshots and the extension ZIP are retained as run artifacts.

Only passing builds on `main` deploy to GitHub Pages. Pull requests never deploy and receive read-only permissions. Deployment uses the `github-pages` environment and GitHub's short-lived OIDC token, not a stored personal access token. Actions are commit-pinned; Dependabot opens weekly dependency updates.

Enable **Settings > Pages > Source > GitHub Actions**. The workflow uploads only `dist/`, never the repository, dependencies, or test files. To roll back, revert the unwanted commit on `main`; the pipeline rebuilds and redeploys it.

## Custom domain: Namecheap

Set **Settings > Pages > Custom domain** to `bananify.online` in GitHub before pointing DNS at Pages. The source `CNAME` documents the intended domain, but Actions deployments use the domain in GitHub's Pages settings.

In Namecheap, open **Domain List > Manage > Advanced DNS > Host Records** and set:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A Record | @ | 185.199.108.153 | Automatic |
| A Record | @ | 185.199.109.153 | Automatic |
| A Record | @ | 185.199.110.153 | Automatic |
| A Record | @ | 185.199.111.153 | Automatic |
| CNAME Record | www | jamesmontemagno.github.io | Automatic |

Replace conflicting parking/URL-redirect records at `@` and `www`; preserve unrelated email, TXT, and verification records. Do not add a wildcard record. If Advanced DNS is managed elsewhere, edit these records at the authoritative DNS provider instead; do not change nameservers without migrating existing records.

GitHub redirects `www.bananify.online` to the apex domain after both are configured. DNS and certificate provisioning can take up to 24 hours. Enable **Enforce HTTPS** in Pages after GitHub issues the certificate. Account-level domain verification is recommended under <https://github.com/settings/pages>; publish the exact TXT record GitHub provides.
