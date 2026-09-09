"use strict";

const fs = require("node:fs");
const path = require("node:path");

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/;

function checkReleaseVersion(version, tag = "") {
  if (typeof version !== "string" || !versionPattern.test(version) || version.split(".").some((part) => Number(part) > 65535)) {
    throw new Error("VSIX version must have three or four numeric components, each from 0 to 65535, without leading zeros.");
  }
  if (tag !== "" && tag !== `visualstudio-v${version}`) {
    throw new Error(`Release tag must be visualstudio-v${version}; received ${JSON.stringify(tag)}.`);
  }
  return version;
}

function sourceVersion(manifest, props) {
  const withoutComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, "");
  const identities = [...withoutComments(manifest).matchAll(/<Identity\b([^>]*)\/?\s*>/g)];
  const versions = [...withoutComments(props).matchAll(/<Version>\s*([^<]*?)\s*<\/Version>/g)];
  if (identities.length !== 1 || versions.length !== 1) {
    throw new Error("Expected one VSIX Identity and one shared build Version.");
  }
  const version = identities[0][1].match(/\bVersion\s*=\s*(["'])(.*?)\1/)?.[2];
  checkReleaseVersion(version);
  if (versions[0][1] !== version) {
    throw new Error(`Directory.Build.props version must match the VSIX version ${version}.`);
  }
  return version;
}

function readSourceVersion() {
  const root = path.resolve(__dirname, "..");
  return sourceVersion(fs.readFileSync(path.join(root, "src/Bananify/source.extension.vsixmanifest"), "utf8"),
    fs.readFileSync(path.join(root, "Directory.Build.props"), "utf8"));
}

module.exports = { checkReleaseVersion, sourceVersion, readSourceVersion };

if (require.main === module) {
  try {
    if (process.argv.length > 4) throw new Error("Usage: node release-version.cjs [packagedVersion [releaseTag]]");
    const tag = process.argv[3] ?? process.env.RELEASE_TAG ?? "";
    const version = checkReleaseVersion(readSourceVersion(), tag);
    if (process.argv.length >= 3) {
      const packagedVersion = checkReleaseVersion(process.argv[2], tag);
      if (packagedVersion !== version) throw new Error(`Packaged VSIX version ${packagedVersion} does not match source version ${version}.`);
    }
    console.log(`Verified Visual Studio version ${version}${tag ? ` for ${tag}` : ""}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
