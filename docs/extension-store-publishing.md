# Publishing Bananify to extension stores

Last reviewed: September 6, 2026.

This guide covers the **Chrome Web Store** and **Microsoft Edge Add-ons**. Publish the first version manually in each store, then automate updates after the listings and publisher accounts are established. GitHub Releases remain available for people who prefer installing an unpacked extension.

This document is a publishing guide, not confirmation of a store submission. Store policies, dashboard fields, fees, and review times can change; consult the official references at the end when submitting.

## Where we are today

| Item | Current state |
| --- | --- |
| Website | <https://bananify.online> |
| Source | <https://github.com/jamesmontemagno/bananify> |
| GitHub releases | [Latest release](https://github.com/jamesmontemagno/bananify/releases/latest) |
| Runtime | Manifest V3; all executable code and artwork bundled locally |
| Permissions | `activeTab` and `scripting` |
| License | MIT; include the existing `LICENSE` in all distributions |
| CI/CD | Checks, browser tests, Pages deployment, and tag-triggered GitHub Releases |
| Store packaging | Separate root-manifest ZIP, CI artifact, and future release asset |
| Store submission automation | Not implemented; upload packages manually |
| Store accounts and listing IDs | Must be created or confirmed by James |
| Public privacy policy | Must be written, published, and linked before submission |

**Use `bananify-store.zip` for store upload**, not the nested `bananify-extension.zip`. New builds create both; the already-published `v1.1.0` assets remain unchanged. The [store submission kit](../store/README.md) includes upload-sized graphics, runtime screenshots, listing text, and fields to fill in.

## 1. Set up publisher accounts

### Chrome Web Store

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) with the Google account that should own Bananify.
2. Register as a developer, accept the agreements, and pay the **one-time registration fee**. Confirm the current amount in Google's dashboard.
3. Choose the account carefully: Google's documentation says its associated email cannot simply be changed later; transferring items requires a separate process.
4. Complete the publisher profile and verify a monitored contact email. Enable two-step verification and keep recovery access secure.
5. Use an accurate publisher identity. Keep **"Made by James Montemagno & Mooch"** as the creative credit; legal and verification fields must identify the real account owner.
6. Optionally verify `bananify.online` through Google Search Console so it can be selected as an official publisher URL. GitHub Pages domain configuration does not perform Google ownership verification.

### Microsoft Edge Add-ons

1. Open [Partner Center for Microsoft Edge](https://partner.microsoft.com/dashboard/microsoftedge/public/login).
2. Enroll in the **Microsoft Edge program**. Microsoft states there is **no registration fee** for this program.
3. Use a Microsoft account as the primary owner. Microsoft's current guidance does not support enrolling directly with a work/school account; an organization can associate its Microsoft Entra tenant afterward.
4. Choose **Individual** for personal/unincorporated publishing, or **Company** for a registered business. Account type and country/region are consequential choices and cannot simply be changed after enrollment.
5. Provide the actual publisher/contact information and finish any verification. Company verification can take longer.

Account registration, payments, identity verification, and agreement acceptance should be completed by the account owner. Do not put passwords, API keys, or recovery codes in the repository or a chat.

## 2. Prepare the correct store package

Build from the exact version intended for submission, ideally a clean checkout of a new Git tag that includes the store-packaging changes. Do not upload a build containing unrelated uncommitted work. The old `v1.1.0` tag predates automated store packaging.

Run these commands from the repository root:

```sh
npm ci
npm run release:check
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run release:package
```

On a Mac with Edge installed, `BROWSER_CHANNEL=msedge npm run test:browser` can replace the Chromium installation/browser-test commands.

The build creates both ZIP layouts from the same allowlisted files. `release:package` copies them to `release/` and writes checksums for both. Upload **`release/bananify-store.zip`** to either dashboard. CI retains both in the `bananify-extension` artifact, and future tagged releases attach both. `release:package` recreates `release/`, so do not keep handwritten notes there.

The store ZIP must contain:

```text
manifest.json
background.js
artwork.js
party.js
toggle.js
LICENSE
icons/
  banana-16.png
  banana-32.png
  banana-48.png
  banana-128.png
```

There must be **no enclosing `bananify/` directory**. Do not upload the whole repository, GitHub's automatic source archive, `dist/`, `node_modules/`, tests, website files, or a `.crx` generated by a local browser.

Before submitting, extract this store ZIP into a separate temporary folder and load that exact folder in both Chrome and Edge. Keep the package browser-neutral: do not copy one store's extension ID or update URL into the other store's package.

## 3. Prepare listing assets

The [store assets folder](../store/assets/) contains the original banana/capuchin artwork at store sizes and before/after screenshots of the packaged runtime on a controlled sample page. The capture method is documented in the kit; no browser toolbar or store installation is depicted.

| Asset | Chrome Web Store | Edge Add-ons |
| --- | --- | --- |
| Listing icon | 128 x 128 PNG | Square; 300 x 300 recommended, 128 x 128 minimum |
| Screenshots | At least 1, up to 5; use 1280 x 800 | Optional, up to 6; use 1280 x 800 for cross-store compatibility |
| Small promotional tile | 440 x 280, required | 440 x 280, optional |
| Marquee promotional tile | 1400 x 560, optional | Not needed for the initial Edge submission |
| Promotional video | Optional | Not needed for the initial submission |

The kit includes 128-pixel and 300-pixel icons rendered from the original icon generator, not upscaled bitmaps. Review dashboard previews for padding and visual weight.

**Do not upload `social-card.png` as a store screenshot or small tile:** it is 1200 x 630 and serves a different purpose. Use the kit's 1280 x 800 screenshots and 440 x 280 promotional tile instead.

Optional additional screenshots beyond the included party/restored pair:

1. Banana rain and a black-and-white capuchin on a normal page.
2. The other monkey guests and **More bananas**.
3. An image or short text disguised as a banana, followed by the restored page.
4. Working controls and the paused party.

Use a controlled sample page without personal information, private account details, or third-party imagery you cannot republish. Run `npm run build` and `npm run store:assets` to refresh the included captures; see the kit for browser setup and provenance.

## 4. Prepare listing copy and URLs

Suggested fields:

| Field | Suggested value |
| --- | --- |
| Name | Bananify |
| Primary language | English |
| Category | The closest available Fun/Entertainment category |
| Price | Free |
| Website | <https://bananify.online> |
| Support | <https://github.com/jamesmontemagno/bananify/issues> |
| Privacy policy | Proposed: `https://bananify.online/privacy.html` **after it is implemented and live** |
| Creative credit | Made by James Montemagno & Mooch |

The manifest description is used as package metadata; Chrome limits it to 132 characters. The current description fits. Uploading corrected manifest metadata requires a new package/version, not just editing the listing.

Suggested long description:

> Give the internet a wildly unnecessary banana upgrade.
>
> Click Bananify to start a banana shower and invite a random brown capuchin, black-and-white capuchin, or golden monkey. Some visible images and short text temporarily turn into bananas, while forms, navigation, and editable content stay usable.
>
> More bananas brings a different monkey and transforms more of the page. Pause freezes the animation. Restore page removes the party and restores the disguised elements without discarding live page updates.
>
> Bananify runs locally on the tab you choose. It does not send page content to a server, use analytics, or load remote executable code. Reduced-motion preferences are respected.
>
> Browser settings, extension stores, and some built-in viewers cannot be modified. A party ends when you reload or navigate away.
>
> Made by James Montemagno & Mooch.

Do not advertise mobile support, automatic updates for unpacked installs, access to protected browser pages, or approval by either store. Store approval is a review outcome, not something the project can promise.

## 5. Publish an accurate privacy policy and disclosures

**Local processing still needs disclosure.** Chrome's User Data FAQ explicitly includes locally processed data and website content. Bananify reads page elements, text lengths, geometry, and styles to choose what to disguise. It also handles clicks locally to draw confetti.

The policy should explain:

- The user activates the extension on the current tab.
- Page content, layout/style information, and click positions are processed locally for the visual effect.
- Original element references and opacity values are held temporarily in memory to restore the page.
- The extension does not transmit this information, persist it to extension storage, sell it, use analytics, or load remote executable code.
- Stopping the party or leaving the page releases its temporary state; unrelated website changes are preserved.
- Website visits, GitHub downloads, and support issues are separate from the extension and are handled by those hosting/support services. Do not promise that GitHub itself records no requests.
- A real contact method and effective date are provided.

Do not say "we never access website content." Review the website's current **"No data collection"** wording before submission; **"Runs locally. No tracking. No data sent."** is more precise about this extension's behavior.

For dashboard data-category questions, explicitly account for local **website-content** processing and, where the form requests it, local click interaction. Do not mark every category as unused solely because nothing leaves the device. Follow the current form's definitions and explain the local-only scope in the policy and reviewer notes. The publisher must review the final legal/disclosure text.

Suggested single-purpose statement:

> Bananify adds a user-triggered, reversible banana-themed visual celebration to the current webpage.

Suggested permission justifications:

| Permission | Explanation |
| --- | --- |
| `activeTab` | Provides temporary access to the selected tab after the user clicks Bananify, so the extension can display the party and temporarily disguise eligible elements on that page. It does not request persistent access to all websites. |
| `scripting` | Injects the extension's locally bundled artwork, party controller, and toggle code into the authorized tab. This implements the user-requested effect and its cleanup. |

Remote-code declaration: **No remote executable code.** Everything needed by the extension is in its package. A link to GitHub or the homepage is not remote executable code.

Privacy-page implementation is still required. Because `scripts/build.mjs` deploys an explicit allowlist, adding a source `privacy.html` alone will not publish it: update the build and its allowlist test, add a website link, and confirm the HTTPS policy URL works without signing in.

## 6. Submit the first Chrome Web Store listing

1. Open the Developer Dashboard and select **Add new item**.
2. Upload the **store-rooted ZIP**, not the manual-install ZIP.
3. Complete Store Listing: description, category, language, icon, screenshots, small promotional tile, homepage, and support link.
4. Complete Privacy: single purpose, permission justifications, remote-code declaration, local data handling, policy URL, and applicable certifications.
5. Choose distribution countries and visibility. Use public distribution for the launch; restricted testing can be used first if desired.
6. Add the reviewer instructions below. No login or payment is needed to use Bananify.
7. Submit for review. For a coordinated launch, choose deferred publishing if available rather than publishing immediately after approval.
8. Resolve any review feedback, then confirm the live listing and save its extension ID and URL.

Review time varies. Do not promise a launch date based only on the submission date.

## 7. Submit the first Edge Add-ons listing

1. Open Partner Center's Microsoft Edge program and create a new extension.
2. Upload the same browser-neutral, store-rooted ZIP.
3. Complete availability/properties, privacy declarations, and the localized listing details.
4. Add the logo, screenshots, homepage, support contact, and live privacy policy URL.
5. Add certification notes using the instructions below and submit.
6. Respond to certification feedback and confirm the listing becomes **In the Store**.
7. Record the Edge product ID, extension/listing URL, and publisher account separately from Chrome's identifiers.

Microsoft's publishing guide says certification can take up to seven business days; allow extra time for account verification, questions, and resubmissions.

### Reviewer instructions to paste into either dashboard

> No account, credentials, payment, or external service is required.
>
> Open an ordinary HTTPS page with some images and short text, then click the Bananify toolbar icon. A banana shower, a random monkey guest, and a small control bar appear. Some eligible visible images/text may be temporarily disguised; forms, links, navigation, live announcements, and editable/focusable elements are excluded.
>
> Click More bananas to change the monkey and increase the effect. Use Pause/Resume to control animation. Click Restore page, or click the toolbar icon again, to remove the effect. Confirm links and typing continue to work. Reloading or navigating ends the party.
>
> With reduced motion enabled in the operating system, the party is static and Pause is hidden.
>
> Chrome/Edge internal pages, extension stores, and some built-in viewers intentionally cannot be changed. Trying there produces an exclamation badge and an explanatory toolbar tooltip.
>
> Page-content processing and click handling stay local to the browser; the extension has no network requests, remote executable code, telemetry, account system, or persistent storage.

## 8. After approval

1. Install the actual store-distributed version in a clean browser profile and confirm the core flows.
2. Update `index.html` with separate **Add to Chrome** and **Get for Microsoft Edge** links using the real approved listing URLs. Keep GitHub Releases as a clearly labeled manual-install alternative.
3. Update installation copy, download-related structured data, README, and browser tests together. Never invent store URLs before IDs exist.
4. Tell existing unpacked-install users to remove or disable that copy before installing from a store, avoiding two simultaneous Bananify extensions.
5. Monitor store reviews, support issues, and publisher email.

Store installations can receive browser-managed updates through the same listing. GitHub ZIP installations remain manual and do not automatically migrate to a store installation.

## 9. Future releases and store automation

Keep the current tag-driven GitHub Release workflow. An uploaded GitHub ZIP is **not** a store submission, and publishing on GitHub does not update either store.

For each store update, increase the manifest version and synchronize npm metadata. This repository validates `manifest.json`, `package.json`, and both root versions in `package-lock.json`. Use a version higher than the previous uploaded store package; never replace an already-published tag or silently change its assets.

Package generation and checksums are implemented. Store API submission is intentionally deferred. Recommended next steps:

1. Use the existing `bananify-extension.zip` and `bananify-store.zip` from the tested release, with checksums.
2. Add a manually approved store-publishing workflow that accepts an existing release tag and downloads/verifies that release's artifacts. Do not rebuild an unpinned `main` branch.
3. Use separate protected GitHub environments for Chrome and Edge. Store credentials in environment secrets, not source or release assets, and never expose them to pull-request jobs.
4. Upload packages and monitor upload status before submitting for review. Treat uploaded, in-review, approved, and publicly available as different states.
5. Preserve each store listing ID for updates. Keep deployment/review status independent for the two stores.

**Chrome:** enable the Chrome Web Store API in a Google Cloud project and follow the current **v2 API** setup. Record the publisher ID and extension ID. Configure OAuth credentials or an appropriately authorized service account using Google's supported process. Protect credentials and account for token expiration/revocation.

**Edge:** after the first listing is published, use the **Update REST API v1.1**. Partner Center provides a Client ID and API key. Do not implement older tutorials based on the retired v1 access-token flow. Keep the product ID separate and monitor/rotate credentials as directed by Partner Center.

Neither API bypasses store review. If a release is faulty, fix it in a **higher version** and resubmit; reverting a website commit or replacing a GitHub asset will not roll back an installed store extension.

## Launch checklist

- [ ] James owns verified publisher accounts and receives their email.
- [ ] A tagged, tested store ZIP has `manifest.json` at its root and includes the MIT license.
- [ ] The exact store ZIP runs correctly in both target browsers.
- [ ] Store-sized icons, screenshots, and the Chrome small tile are ready.
- [ ] A reviewed privacy policy is public over HTTPS and describes local processing.
- [ ] Permission and data disclosures match the shipped implementation.
- [ ] Support, website, and privacy URLs work without authentication.
- [ ] Both dashboards have reviewer instructions and completed required fields.
- [ ] The first submissions are approved and the live store builds are exercised.
- [ ] The website links to real approved listings; manual downloads remain available.
- [ ] Store automation is configured only after accounts, listing IDs, and protected credentials are ready.

## Official references

- [Chrome: register a developer account](https://developer.chrome.com/docs/webstore/register)
- [Chrome: set up the publisher profile](https://developer.chrome.com/docs/webstore/set-up-account)
- [Chrome: prepare the manifest and ZIP](https://developer.chrome.com/docs/webstore/prepare)
- [Chrome: image requirements](https://developer.chrome.com/docs/webstore/images)
- [Chrome: store listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Chrome: privacy disclosures](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome: User Data FAQ, including local processing](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome: submit and publish](https://developer.chrome.com/docs/webstore/publish)
- [Chrome: API setup and v2 operations](https://developer.chrome.com/docs/webstore/using-api)
- [Edge: register a developer account](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/create-dev-account)
- [Edge: package, listing, privacy, and certification](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/publish-extension)
- [Edge: Update REST API v1.1](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api)
