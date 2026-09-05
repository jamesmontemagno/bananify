import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateReleaseVersion(manifest, packageJson, lockfile, tag = "") {
  const version = manifest.version;
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    || version.split(".").some((part) => Number(part) > 65535) || version === "0.0.0") {
    throw new Error("Extension releases require a nonzero major.minor.patch version with components from 0 to 65535.");
  }
  if (packageJson.version !== version || lockfile.version !== version || lockfile.packages?.[""]?.version !== version) {
    throw new Error("manifest.json, package.json, and package-lock.json must have the same version.");
  }
  if (tag && tag !== `v${version}`) {
    throw new Error(`Release tag ${tag} does not match extension version v${version}.`);
  }
  return version;
}

export async function readReleaseVersion(tag = "") {
  const read = async (name) => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url), "utf8"));
  return validateReleaseVersion(
    await read("manifest.json"), await read("package.json"), await read("package-lock.json"), tag,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await readReleaseVersion(process.env.RELEASE_TAG || ""));
}
