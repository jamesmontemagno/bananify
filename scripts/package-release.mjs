import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readReleaseVersion } from "./release-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function packageRelease() {
  const version = await readReleaseVersion(process.env.RELEASE_TAG || "");
  const archives = [
    ["bananify-extension.zip", "bananify/manifest.json"],
    ["bananify-store.zip", "manifest.json"],
  ];
  for (const [name, manifestPath] of archives) {
    const archive = join(root, "dist/downloads", name);
    const packagedManifest = JSON.parse(execFileSync("unzip", ["-p", archive, manifestPath], { encoding: "utf8" }));
    if (packagedManifest.name !== "Bananify" || packagedManifest.version !== version) {
      throw new Error(`The ${name} ZIP is stale. Run npm run build before packaging the release.`);
    }
  }
  const output = join(root, "release");
  await rm(output, { recursive: true, force: true });
  await mkdir(output);
  const checksums = [];
  for (const [name] of archives) {
    const archive = join(root, "dist/downloads", name);
    await cp(archive, join(output, name));
    const checksum = createHash("sha256").update(await readFile(archive)).digest("hex");
    checksums.push(`${checksum}  ${name}\n`);
  }
  await writeFile(join(output, "SHA256SUMS.txt"), checksums.join(""));
  await writeFile(join(output, "RELEASE_NOTES.md"), `## Bananify ${version}

Download **bananify-extension.zip** from the assets below, not GitHub's automatic source-code archives.

### Choose the right ZIP

- **bananify-extension.zip** is for manual installation. Extract it to get a **bananify** folder, then load that folder as described below.
- **bananify-store.zip** is for maintainers submitting manually to the **Chrome Web Store** or **Microsoft Edge Add-ons** dashboard. Upload this ZIP directly: \`manifest.json\` is at its root. It contains the same extension files as the manual-install ZIP, without the enclosing folder.

CI only prepares these packages; it does not submit to either store or use store publishing APIs.

### Install in Chrome or Edge

1. Extract the ZIP.
2. Open \`chrome://extensions\` or \`edge://extensions\` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted **bananify** folder containing \`manifest.json\`.
4. Pin Bananify and click the banana on a regular website.

### Updating an existing install

Replace the files in your existing unpacked extension folder with this release, click **Reload** on its Extensions page, and refresh any open website tabs.

This is a manual install, not a browser-store listing. Unpacked extensions do not update automatically.

**SHA256SUMS.txt** contains the SHA-256 checksums of both ZIPs.

[Try Bananify](https://bananify.online/) · [All releases](https://github.com/jamesmontemagno/bananify/releases)
`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Packaged release in ${await packageRelease()}`);
}
