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

The website download always points to the [latest published release](https://github.com/jamesmontemagno/bananify/releases/latest). [All releases](https://github.com/jamesmontemagno/bananify/releases) retain previous versions, release notes, and SHA-256 checksums. Download **bananify-extension.zip**, not GitHub's automatic source-code archives.

To update an unpacked installation, replace the files in its existing folder with the new release, click **Reload** on the browser's Extensions page, and refresh open website tabs. Unpacked extensions do not update automatically.

Click again to turn it off, or use **Restore page** in the floating controls. Each party invites a random brown capuchin, black-and-white capuchin, or golden monkey. **More bananas** increases the shower, brings a different monkey, and disguises more page elements; **Pause** freezes the animation. Clicking the website tosses a little banana confetti without consuming the click.

Random visible images and short text elements temporarily look like bananas. Their original nodes, dimensions, and event listeners remain intact. Forms, links, navigation, live announcements, editable content, and keyboard-focusable elements are skipped. At most 12 elements are disguised; Restore page restores their previous opacity without overwriting unrelated site updates. Use `data-bananify-protect` on an element or container to keep it unchanged.

The party is per-page and resets on navigation or reload. Browser settings, extension stores, and some built-in viewers don't allow extensions to modify them. A `!` badge and toolbar tooltip explain when a page can't be changed.

## Try it locally

With Node.js 22 or newer and the `zip` command (included on macOS and Ubuntu):

```sh
npm start
```

Open <http://127.0.0.1:4173>. This builds and serves the production site. The main download points to the latest GitHub Release; the current development ZIP is available at <http://127.0.0.1:4173/downloads/bananify-extension.zip>. Restart the server to rebuild after changes. The preview runs the same artwork and party code as the extension; it does not need to be installed first.

## Behavior and privacy

- Only `activeTab` and `scripting` permissions; no always-on site access.
- The extension makes no network requests and uses no analytics, storage, remote libraries, or audio. The website is hosted by GitHub Pages and loads its own static files.
- Original vector bananas and three monkey variants, bundled locally.
- An isolated Shadow DOM overlay keeps decoration styles separate. Selected noninteractive elements temporarily receive `opacity: 0 !important`; their original opacity is restored when the party ends.
- Only the small party control bar intercepts pointer input.
- Reduced-motion preferences get a static banana party; hidden tabs suspend animation.
- Particle counts and transformed elements are bounded. Removal cancels animation, disconnects observers, restores disguises, and removes event listeners.
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

`.github/workflows/pages.yml` runs on pull requests, pushes to `main`, version tags (`v*`), and manual dispatches. It checks version consistency and JavaScript, tests the extension and reproducible ZIP, builds an allowlisted `dist/` directory, and exercises the production site in Chromium at desktop and mobile sizes, including reduced motion, cleanup, and downloads. Screenshots and the extension ZIP are retained as run artifacts.

Only passing builds on `main` deploy to GitHub Pages. Pull requests never deploy and receive read-only permissions. Deployment uses the `github-pages` environment and GitHub's short-lived OIDC token, not a stored personal access token. Actions are commit-pinned; Dependabot opens weekly dependency updates.

Enable **Settings > Pages > Source > GitHub Actions**. The workflow uploads only `dist/`, never the repository, dependencies, or test files. To roll back, revert the unwanted commit on `main`; the pipeline rebuilds and redeploys it.

## Publishing an extension release

Push a stable version tag to run the same CI gates and publish a public GitHub Release:

```sh
# Set manifest.json's version to 1.2.0, then synchronize npm metadata:
npm version 1.2.0 --no-git-tag-version
npm run release:check
npm test
# Commit the version changes and push main before tagging.
git tag -a v1.2.0 -m "Bananify 1.2.0"
git push origin v1.2.0
```

Replace `1.2.0` with the version being released. The tag must exactly match `manifest.json`, `package.json`, and both root versions in `package-lock.json`. Stable three-part versions are supported; prerelease tags are rejected.

After all checks pass, the workflow publishes **bananify-extension.zip**, **SHA256SUMS.txt**, installation/update instructions, and GitHub-generated change notes. It promotes the exact tested build artifact rather than rebuilding with publish permissions. Only the release job has `contents: write`; branch and PR builds cannot publish releases. Tag builds do not redeploy the website.

The stable latest-download URL works without changing the website for each release:
<https://github.com/jamesmontemagno/bananify/releases/latest/download/bananify-extension.zip>

Never move a published version tag or replace its assets. Fixes receive a new patch version. If a first-time publish fails after creating a draft, remove that unfinished draft before rerunning the failed job; an existing published release is never overwritten by this workflow.

For a local release package, run `npm run build && npm run release:package`. The generated `release/` folder contains the ZIP, checksum, and release notes. CI artifacts are temporary; published GitHub Release assets persist until a maintainer deletes them.

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
