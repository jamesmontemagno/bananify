import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readReleaseVersion } from "./release-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function packageRelease() {
  const version = await readReleaseVersion(process.env.RELEASE_TAG || "");
  const archive = join(root, "dist/downloads/bananify-extension.zip");
  const packagedManifest = JSON.parse(execFileSync("unzip", ["-p", archive, "bananify/manifest.json"], { encoding: "utf8" }));
  if (packagedManifest.name !== "Bananify" || packagedManifest.version !== version) {
    throw new Error("The extension ZIP is stale. Run npm run build before packaging the release.");
  }
  const output = join(root, "release");
  await rm(output, { recursive: true, force: true });
  await mkdir(output);
  await cp(archive, join(output, "bananify-extension.zip"));
  const checksum = createHash("sha256").update(await readFile(archive)).digest("hex");
  await writeFile(join(output, "SHA256SUMS.txt"), `${checksum}  bananify-extension.zip\n`);
  await writeFile(join(output, "RELEASE_NOTES.md"), `## Bananify ${version}

Download **bananify-extension.zip** from the assets below, not GitHub's automatic source-code archives.

### Install in Chrome or Edge

1. Extract the ZIP.
2. Open \`chrome://extensions\` or \`edge://extensions\` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted **bananify** folder containing \`manifest.json\`.
4. Pin Bananify and click the banana on a regular website.

### Updating an existing install

Replace the files in your existing unpacked extension folder with this release, click **Reload** on its Extensions page, and refresh any open website tabs.

This is a manual install, not a browser-store listing. Unpacked extensions do not update automatically.

**SHA256SUMS.txt** contains the SHA-256 checksum of the extension ZIP.

[Try Bananify](https://bananify.online/) · [All releases](https://github.com/jamesmontemagno/bananify/releases)
`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Packaged release in ${await packageRelease()}`);
}
