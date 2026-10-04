"use strict";

const fs = require("node:fs");
const path = require("node:path");

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/;
const identityVersionPattern = /(<Identity\b[^>]*\bVersion\s*=\s*)(["'])(.*?)\2/g;
const buildVersionPattern = /(<Version>\s*)([^<]*?)(\s*<\/Version>)/g;
const productVersionPattern = /(\[InstalledProductRegistration\(\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*")([^"]*)("\s*\)\])/g;

function checkReleaseVersion(version, tag = "") {
  if (typeof version !== "string" || !versionPattern.test(version) || version.split(".").some((part) => Number(part) > 65535)) {
    throw new Error("VSIX version must have three or four numeric components, each from 0 to 65535, without leading zeros.");
  }
  if (tag !== "" && tag !== `visualstudio-v${version}`) {
    throw new Error(`Release tag must be visualstudio-v${version}; received ${JSON.stringify(tag)}.`);
  }
  return version;
}

function releaseVersionFromTag(tag) {
  if (typeof tag !== "string" || !tag.startsWith("visualstudio-v")) {
    throw new Error(`Release tag must be visualstudio-v<version>; received ${JSON.stringify(tag)}.`);
  }
  const version = tag.slice("visualstudio-v".length);
  return checkReleaseVersion(version, tag);
}

function sourceVersion(manifest, props, packageSource) {
  const withoutComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, "");
  const identities = [...withoutComments(manifest).matchAll(/<Identity\b([^>]*)\/?\s*>/g)];
  const versions = [...withoutComments(props).matchAll(/<Version>\s*([^<]*?)\s*<\/Version>/g)];
  const productVersions = [...packageSource.matchAll(productVersionPattern)];
  if (identities.length !== 1 || versions.length !== 1 || productVersions.length !== 1) {
    throw new Error("Expected one VSIX Identity, one shared build Version, and one installed product version.");
  }
  const version = identities[0][1].match(/\bVersion\s*=\s*(["'])(.*?)\1/)?.[2];
  checkReleaseVersion(version);
  if (versions[0][1] !== version) {
    throw new Error(`Directory.Build.props version must match the VSIX version ${version}.`);
  }
  if (productVersions[0][2] !== version) {
    throw new Error(`Installed product version must match the VSIX version ${version}.`);
  }
  return version;
}

function stampSourceVersion(manifest, props, packageSource, version) {
  checkReleaseVersion(version);
  const replaceOne = (content, pattern, replacement, label) => {
    let count = 0;
    const result = content.replace(pattern, (...args) => {
      count++;
      return replacement(...args);
    });
    if (count !== 1) throw new Error(`Expected one ${label}; found ${count}.`);
    return result;
  };
  const stamped = {
    manifest: replaceOne(manifest, identityVersionPattern,
      (_match, prefix, quote) => `${prefix}${quote}${version}${quote}`, "VSIX Identity version"),
    props: replaceOne(props, buildVersionPattern,
      (_match, prefix, _current, suffix) => `${prefix}${version}${suffix}`, "shared build Version"),
    packageSource: replaceOne(packageSource, productVersionPattern,
      (_match, prefix, _current, suffix) => `${prefix}${version}${suffix}`, "installed product version"),
  };
  sourceVersion(stamped.manifest, stamped.props, stamped.packageSource);
  return stamped;
}

function sourcePaths() {
  const root = path.resolve(__dirname, "..");
  return {
    manifest: path.join(root, "src/Bananify/source.extension.vsixmanifest"),
    props: path.join(root, "Directory.Build.props"),
    packageSource: path.join(root, "src/Bananify/BananifyPackage.cs"),
  };
}

function readSourceVersion() {
  const files = sourcePaths();
  return sourceVersion(fs.readFileSync(files.manifest, "utf8"), fs.readFileSync(files.props, "utf8"),
    fs.readFileSync(files.packageSource, "utf8"));
}

function stampSourceFiles(tag) {
  const version = releaseVersionFromTag(tag);
  const files = sourcePaths();
  const stamped = stampSourceVersion(fs.readFileSync(files.manifest, "utf8"), fs.readFileSync(files.props, "utf8"),
    fs.readFileSync(files.packageSource, "utf8"), version);
  fs.writeFileSync(files.manifest, stamped.manifest);
  fs.writeFileSync(files.props, stamped.props);
  fs.writeFileSync(files.packageSource, stamped.packageSource);
  return version;
}

module.exports = {
  checkReleaseVersion, releaseVersionFromTag, sourceVersion, stampSourceVersion, readSourceVersion, stampSourceFiles,
};

if (require.main === module) {
  try {
    if (process.argv.length > 4) throw new Error("Usage: node release-version.cjs [packagedVersion [releaseTag]]");
    if (process.argv[2] === "--stamp") {
      if (process.argv.length !== 3) throw new Error("Usage: node release-version.cjs --stamp");
      const tag = process.env.RELEASE_TAG ?? "";
      const version = tag ? stampSourceFiles(tag) : readSourceVersion();
      console.log(`${tag ? "Stamped" : "Verified"} Visual Studio version ${version}${tag ? ` for ${tag}` : ""}.`);
    } else if (process.argv.length >= 3) {
      const tag = process.argv[3] ?? process.env.RELEASE_TAG ?? "";
      const packagedVersion = checkReleaseVersion(process.argv[2], tag);
      if (!tag) throw new Error("A release tag is required when validating a packaged VSIX version.");
      releaseVersionFromTag(tag);
      console.log(`Verified packaged Visual Studio version ${packagedVersion} for ${tag}.`);
    } else {
      const tag = process.env.RELEASE_TAG ?? "";
      const version = checkReleaseVersion(readSourceVersion(), tag);
      console.log(`Verified Visual Studio version ${version}${tag ? ` for ${tag}` : ""}.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
