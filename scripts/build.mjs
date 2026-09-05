import { cp, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readReleaseVersion } from "./release-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteFiles = [
  "index.html", "preview.css", "preview.js", "artwork.js", "party.js",
  "CNAME", "robots.txt", "sitemap.xml", "social-card.png",
];

export async function buildSite() {
  await readReleaseVersion();
  const output = join(root, "dist");
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  const icons = [...new Set(Object.values(manifest.icons))];
  const extensionFiles = ["manifest.json", "background.js", "artwork.js", "party.js", "toggle.js", ...icons];
  const temporary = await mkdtemp(join(tmpdir(), "bananify-build-"));
  try {
    await rm(output, { recursive: true, force: true });
    await mkdir(join(output, "downloads"), { recursive: true });
    for (const file of [...siteFiles, ...icons]) {
      await mkdir(dirname(join(output, file)), { recursive: true });
      await cp(join(root, file), join(output, file));
    }
    await writeFile(join(output, ".nojekyll"), "");
    const archiveFiles = extensionFiles.map((file) => `bananify/${file}`).sort();
    for (const file of extensionFiles) {
      const destination = join(temporary, "bananify", file);
      await mkdir(dirname(destination), { recursive: true });
      await cp(join(root, file), destination);
      // Stable timestamps and stripped metadata make the download reproducible.
      await utimes(destination, new Date("2000-01-01T00:00:00Z"), new Date("2000-01-01T00:00:00Z"));
    }
    execFileSync("zip", ["-X", "-q", join(output, "downloads/bananify-extension.zip"), ...archiveFiles], {
      cwd: temporary,
      env: { ...process.env, TZ: "UTC" },
      stdio: "pipe",
    });
    return output;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Built Bananify site and extension ZIP in ${await buildSite()}`);
}
