# Bananify store submission kit

Ready-to-copy listing text and artwork for **Chrome Web Store** and **Microsoft Edge Add-ons**. Nothing here submits or publishes to a store. Account verification, agreements, privacy policy publication, and final dashboard declarations are still your responsibility.

## 1. Get the upload package

From a checkout of the version you intend to submit:

```sh
npm ci
npm run build
npm run release:package
```

Upload **`release/bananify-store.zip`** to either store. Its `manifest.json` is at the ZIP root. Do not upload `bananify-extension.zip`: that is the nested archive for manual installs.

CI creates both packages and their `SHA256SUMS.txt` in the **bananify-extension** workflow artifact. The separate **bananify-store-listing** artifact contains this folder. Future tagged GitHub Releases also attach the store ZIP. The already-published `v1.1.0` release is unchanged; it does not retroactively gain the new ZIP.

Before uploading, inspect the ZIP's manifest version and load its extracted contents in both browsers. Use a higher manifest version for subsequent store updates. Never upload the entire `store/` folder as the extension.

## 2. Upload these images

| File | Dimensions | Use |
| --- | --- | --- |
| [assets/icon-128.png](assets/icon-128.png) | 128 x 128 | Chrome listing icon |
| [assets/icon-300.png](assets/icon-300.png) | 300 x 300 | Edge listing logo, rendered at native size |
| [assets/promo-440x280.png](assets/promo-440x280.png) | 440 x 280 | Chrome required small promotional tile; optional Edge tile |
| [assets/screenshot-party.png](assets/screenshot-party.png) | 1280 x 800 | Screenshot 1: banana party and monkey, paused for capture |
| [assets/screenshot-restored.png](assets/screenshot-restored.png) | 1280 x 800 | Screenshot 2: the same page after Restore page |

Screenshot captions:

1. **A banana break for your browser.** Banana rain, surprise monkey guests, and playful page disguises. Pause whenever you like.
2. **Back to your regularly scheduled internet.** Restore page removes the party and restores disguised content.

These are browser captures of the exact packaged runtime on an original, controlled sample page, not a mock-up. The capture harness executes the same scripts the toolbar injects; it does not show an installed store listing, browser toolbar, or store approval. No private data or third-party imagery is included. [assets/capture.json](assets/capture.json) records the package version and capture method.

The promotional tile is marketing artwork, not a screenshot. Original banana and monkey art is covered by the repository's [MIT license](../LICENSE).

To regenerate after changing the extension or artwork:

```sh
npm run build
npx playwright install chromium
npm run store:assets
```

On a Mac with Edge installed, replace the last two commands with `BROWSER_CHANNEL=msedge npm run store:assets`. Generation changes the tracked assets; review and commit them with the release. Monkey choice and banana positions vary naturally. CI packages the committed images, rather than silently regenerating listing art.

## 3. Common listing fields

| Field | Value to enter |
| --- | --- |
| Name | Bananify |
| Language | English |
| Short description | Turn websites into a banana party with dancing monkeys, banana rain, and a one-click restore. |
| Category | Choose the closest current Fun / Entertainment category |
| Price | Free |
| Homepage | https://bananify.online |
| Support URL | https://github.com/jamesmontemagno/bananify/issues |
| Source code | https://github.com/jamesmontemagno/bananify |
| Creative credit | Made by James Montemagno & Mooch |
| License | MIT |
| Publisher identity | **Fill in:** the verified legal/account owner, not an invented organization |
| Support/contact email | **Fill in:** an email you monitor; verify it in the dashboard |
| Privacy policy URL | **Required before submission:** publish a reviewed policy at an HTTPS URL |
| Distribution regions | **Choose:** countries/regions you want to support |

`https://bananify.online/privacy.html` is only a suggested policy location. **It is not implemented by this kit; do not enter it until it actually works.** See the [privacy guidance](../docs/extension-store-publishing.md#5-publish-an-accurate-privacy-policy-and-disclosures). The policy needs to describe local page-content processing even though the extension sends no data out.

### Detailed description

Copy the following into the store's description field:

```text
Give the internet a wildly unnecessary banana upgrade.

Click Bananify to start a banana shower and invite a random brown capuchin,
black-and-white capuchin, or golden monkey. Some visible images and short
text temporarily look like bananas, while forms, links, navigation, and
editable content are left alone.

More bananas brings a different monkey and transforms more of the page.
Pause freezes the animation. Restore page removes the party and restores
the disguised elements without discarding unrelated live page updates.

Bananify runs locally on the tab you choose. The extension does not send
page content to a server, use analytics, or load remote executable code.
Reduced-motion preferences get a static banana party.

Browser settings, extension stores, and some built-in viewers cannot be
modified. A party ends when you reload or navigate away.

Made by James Montemagno & Mooch.
```

### Single-purpose statement

```text
Bananify adds a temporary, reversible banana-themed visual party to the
current webpage when the user clicks the extension toolbar button.
```

### Permission justifications

| Permission | Copyable explanation |
| --- | --- |
| `activeTab` | Grants temporary access to the tab the user explicitly chooses by clicking the toolbar button. Bananify uses that access to start or stop its visual effects without requesting always-on access to websites. |
| `scripting` | Injects the locally bundled artwork and party scripts into the selected tab to display banana decorations and controls and restore temporary page disguises. |

No persistent host permissions, remote executable code, account login, payments, analytics, or persistent extension storage.

### Privacy declarations: review before selecting answers

The extension reads page element types, text lengths, styles, and geometry to select and position temporary disguises. It uses local click positions for confetti. It temporarily changes opacity on eligible elements and restores its changes when stopped. This is **local processing of website content**, not a claim of accessing no data.

The extension does not transmit that content, sell data, track users, or store browsing history. Do not blindly select "no data accessed" just because no data leaves the device. Answer the exact current form questions truthfully, using the [Chrome User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) and your published privacy policy. Distinguish the extension from the separately hosted GitHub Pages website.

### Reviewer / certification notes

```text
No account, credentials, payment, or external service is required.

1. Open an ordinary HTTPS webpage with images and short text.
2. Click Bananify in the browser toolbar. Banana decorations, a random
   monkey, and a floating control bar appear.
3. Click More bananas to change the monkey and add more effects.
4. Use Pause/Resume to control animation.
5. Click Restore page, or the toolbar icon again, to remove the effects
   and restore disguised elements. Links and form inputs remain usable.
6. With OS reduced motion enabled, the party is static and Pause is hidden.

Browser internal pages and extension stores intentionally cannot be
modified. A blocked page produces a ! toolbar badge and explanatory tooltip.
Navigating or reloading ends the party.

All executable code and artwork are bundled. Page processing stays local.
```

## 4. Finish each dashboard

**Chrome:** use the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Complete registration, verified contact information, store listing, privacy practices, distribution, and any required certifications. Upload the store ZIP, icon, both screenshots, and small promotional tile. Review the preview before submitting.

**Edge:** use [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login). Complete publisher verification, create the extension, upload the same store ZIP, then complete availability, properties, listing, privacy, and certification notes. Use the 300-pixel logo and shared screenshots. First publication is manual.

Store review is not instant, and a successful ZIP upload is not approval. Respond to feedback in each dashboard separately.

## 5. Keep these non-secret details for later API setup

Fill these in after creating the listings. Never commit credentials.

| Item | Your value |
| --- | --- |
| Chrome publisher ID | |
| Chrome extension/item ID | `ahlgjleaimihpbcpadijmmeeokpfnflc` |
| Chrome public listing URL | Pending; confirm the live URL before linking from the website |
| Google Cloud project ID for Chrome API | |
| Edge product ID (Partner Center) | `0RDCKCQWS0QS` |
| Edge public listing URL | Pending; obtain the public Add-ons URL, not the CRX download |
| Published privacy policy URL | |
| First approved version in each store | |

Later automation will need Chrome Web Store API v2 authorization and Edge Update API v1.1 credentials. Configure those directly in protected GitHub environment secrets when ready, not in this file. No API workflows, credentials, or automatic store submission are included now.

### Replace the website placeholders when the stores are live

The website and README currently show **Coming soon** for both stores, with no placeholder links. The IDs above were supplied by the publisher; they do not establish public availability. Edge's Partner Center product ID is not its public add-on ID.

Once each listing is publicly accessible, replace its entry in `index.html` (`.store-listings`) and the README availability table with the verified listing link. Update the corresponding browser assertions, this table, and installation guidance together. Keep the manual ZIP as an alternative, and warn existing unpacked-install users to remove or disable that copy before installing from a store. Do not change the other store to available until it is also live.

## Before you click Submit

- [ ] Publisher account and monitored contact email verified.
- [ ] Correct store ZIP and version selected; exact extracted package exercised in Chrome and Edge.
- [ ] Screenshots match the version being submitted; image previews look right.
- [ ] Description, category, language, regions, and support details completed.
- [ ] Public privacy policy is live and matches the implementation.
- [ ] Permission/data declarations and reviewer notes completed.
- [ ] No claim of store approval or unsupported mobile/browser functionality.

Full background and official references: [extension store publishing guide](../docs/extension-store-publishing.md).
