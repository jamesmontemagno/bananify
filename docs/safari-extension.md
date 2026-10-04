# Safari extension publishing

Last reviewed: September 15, 2026.

Bananify's Safari build starts from the same WebExtension runtime as Chrome and Edge, then adds Safari metadata in a generated package. The generated ZIP is source material for Apple's converter; it is **not** uploaded directly to App Store Connect.

## What CI/CD produces

`npm run build` now creates:

- `dist/downloads/bananify-safari-web-extension.zip` — reproducible archive of a `bananify-safari/` source folder: the shared runtime files plus a manifest with Safari's `browser_specific_settings`.
- `dist/downloads/SHA256SUMS.txt` — checksums for the Chrome/Edge manual ZIP, Chrome/Edge store ZIP, and Safari source ZIP.

Tagged GitHub releases include the Safari ZIP beside the existing browser packages. The `.github/workflows/safari.yml` workflow runs on Safari-relevant pull requests, pushes to `main`, matching release tags, and manual dispatches. It builds the package on macOS, converts it with `xcrun safari-web-extension-converter`, and builds the generated Xcode project with code signing disabled. It does not upload to App Store Connect or require Apple credentials.

## Build locally

Use Node.js 22+ and a Mac with Xcode installed:

```sh
npm ci
npm run release:check
npm run lint
npm run check
npm test
npm run build
```

The Safari package should contain a `bananify-safari/manifest.json` with `browser_specific_settings.safari.strict_min_version` and the same bundled runtime files as the Chrome/Edge package.

## Convert for Safari

Generate an Xcode project from the tested package:

```sh
rm -rf safari-build
rm -rf safari-source
unzip -q dist/downloads/bananify-safari-web-extension.zip -d safari-source
xcrun safari-web-extension-converter safari-source/bananify-safari \
  --project-location safari-build \
  --app-name Bananify \
  --bundle-identifier online.bananify.Bananify \
  --swift \
  --macos-only \
  --copy-resources \
  --no-open \
  --no-prompt \
  --force
```

Then build it locally:

```sh
xcodebuild \
  -project safari-build/Bananify/Bananify.xcodeproj \
  -scheme Bananify \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Choose the final bundle identifier and signing team before distribution. The `online.bananify.Bananify` identifier used by CI is only a deterministic placeholder for unsigned validation; the generated extension target uses that parent ID plus `.Extension`.

## Test in Safari

1. Open the generated project in Xcode.
2. Set the signing team and bundle identifier you intend to ship.
3. Build and run the containing macOS app.
4. In Safari, enable unsigned extensions while testing if needed, then enable Bananify.
5. Open an ordinary HTTPS page, click the toolbar item, use **More bananas**, **Pause/Resume**, and **Restore page**.
6. Confirm Safari protected pages and extension gallery pages remain off-limits and show the extension's error badge/tooltip behavior.

Keep testing on Chrome and Edge too. Safari packaging must not change the shared runtime files, permissions, or Chrome/Edge store ZIP.

## Publish to the App Store

Safari extensions are distributed through the App Store as an app that contains the Safari web extension. The first release is manual:

1. Enroll in the Apple Developer Program and configure App Store Connect access outside this repository.
2. Convert the tested `bananify-safari-web-extension.zip` source package into an Xcode project.
3. Replace the CI placeholder bundle identifier with the real app and extension identifiers.
4. Set the version on both the app and extension targets. The converter always writes `MARKETING_VERSION = 1.0` and `CURRENT_PROJECT_VERSION = 1`; change `MARKETING_VERSION` to the `manifest.json` version being released and `CURRENT_PROJECT_VERSION` to the build number for this upload.
5. Choose the macOS deployment target. The converter sets the project-level `MACOSX_DEPLOYMENT_TARGET`, which the app target inherits, to the SDK of the Xcode that ran it (26.5 with Xcode 26.6) and gives the extension target 10.14. The app target's value, not the manifest's `strict_min_version`, limits which Macs can install Bananify, so lower it to the oldest macOS release you have tested.
6. Add signing, icons, localized app metadata, screenshots, age rating, support URL, marketing URL, and privacy details in Xcode and App Store Connect.
7. Archive in Xcode, validate, and upload to App Store Connect.
8. Complete App Review notes with the same reviewer flow used for Chrome and Edge: no account, payment, or external service is required; open a normal webpage, click Bananify, test More bananas, Pause/Resume, and Restore page.
9. After approval, record the public App Store URL and update the website, README, structured data, and release docs together.

The Xcode project is regenerated from the release ZIP and never committed, so the bundle identifiers, signing, version, and deployment target must be reapplied after every conversion.

Do not commit Apple certificates, provisioning profiles, API keys, App Store Connect keys, or generated Xcode build products. Future upload automation should use protected GitHub environments and an existing tested release artifact, not a rebuild of an unpinned branch.

## Official references

- [Apple: Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Apple: Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- [Apple: App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
