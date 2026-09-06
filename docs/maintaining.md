# Maintaining Bananify

Release and hosting notes for project maintainers. For installation and features, see the [README](../README.md). For Chrome Web Store and Microsoft Edge Add-ons submissions, see the [store publishing guide](extension-store-publishing.md).

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

After all checks pass, the workflow publishes **bananify-extension.zip** (manual installation), **bananify-store.zip** (root-level manifest for store upload), **SHA256SUMS.txt** covering both ZIPs, installation/update instructions, and GitHub-generated change notes. It promotes the exact tested build artifact rather than rebuilding with publish permissions. Only the release job has `contents: write`; branch and PR builds cannot publish releases. Tag builds do not redeploy the website.

The stable latest-download URL works without changing the website for each release:
<https://github.com/jamesmontemagno/bananify/releases/latest/download/bananify-extension.zip>

Never move a published version tag or replace its assets. Fixes receive a new patch version. If a first-time publish fails after creating a draft, remove that unfinished draft before rerunning the failed job; an existing published release is never overwritten by this workflow.

For local release packages, run `npm run build && npm run release:package`. The generated `release/` folder contains both ZIPs, checksums, and release notes. CI artifacts are temporary; published GitHub Release assets persist until a maintainer deletes them.

The [store submission kit](../store/README.md) contains listing text and upload-sized assets. CI uploads it separately as `bananify-store-listing`; it is not included in the installable extension. No workflow calls a store API or submits for review. Existing releases, including `v1.1.0`, are not modified by these packaging changes.

## Local preview and artwork

`npm start` builds and serves the production website at <http://127.0.0.1:4173>. The main download points to the latest GitHub Release; the current development ZIP is available at <http://127.0.0.1:4173/downloads/bananify-extension.zip>. Restart the server to rebuild after changes.

`npm run icons` regenerates the extension icons. `npm run social` regenerates the social sharing graphic used by the website and README.

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
