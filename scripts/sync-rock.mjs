#!/usr/bin/env node
// Pulls Rock's core style sources (legacy LESS + NextGen Sass) for one Rock
// release into ./Styles, without cloning the whole Rock repository.
//
// Usage:  node scripts/sync-rock.mjs            (uses the version in .rock-version)
//         node scripts/sync-rock.mjs 19.4.4     (any Rock tag or branch)
//         node scripts/sync-rock.mjs --reference   (also copy Stark + RockNextGen into ./reference)
//
// How it works: a blobless, sparse, depth-1 clone of SparkDevNetwork/Rock is kept in
// ./.rock-src. Only the style folders are ever downloaded. Those folders are then
// assembled into ./Styles so it matches RockWeb/Styles on a running Rock server, which
// is what theme imports like "../../../Styles/_rock-core.less" expect.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, ".rock-src");
const OUT = join(ROOT, "Styles");
const REF = join(ROOT, "reference");
const REPO = "https://github.com/SparkDevNetwork/Rock.git";

const args = process.argv.slice(2);
const withReference = args.includes("--reference");
const versionArg = args.find(a => !a.startsWith("--"));
const versionFile = join(ROOT, ".rock-version");
const version = versionArg ?? (existsSync(versionFile) ? readFileSync(versionFile, "utf8").trim() : null);
if (!version) {
    console.error("No Rock version given. Pass one (e.g. 19.4.4) or put it in .rock-version.");
    process.exit(1);
}

// Style sources in Rock. Rock 18 kept the Sass in RockWeb/Styles/styles-v2; Rock 19+
// moved it to Rock.Frontend.Styles and builds it into RockWeb/Styles at compile time.
const SPARSE_PATHS = [
    "/RockWeb/Styles/",
    "/Rock.Frontend.Styles/src/styles/",
    // Reference copies of Rock's own starter themes (only copied out with --reference).
    "/RockWeb/Themes/Stark/",
    "/RockWeb/Themes/RockNextGen/",
    "/Rock.Frontend.Styles/src/themes/RockNextGen/",
];

const git = (...a) => execFileSync("git", ["-C", SRC, ...a], { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

if (!existsSync(join(SRC, ".git"))) {
    console.log("Creating sparse Rock checkout in .rock-src ...");
    mkdirSync(SRC, { recursive: true });
    execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", REPO, SRC], { stdio: "inherit" });
}
git("sparse-checkout", "set", "--no-cone", ...SPARSE_PATHS);

console.log(`Fetching Rock ${version} ...`);
git("fetch", "--depth", "1", "--filter=blob:none", "origin", version);
git("-c", "advice.detachedHead=false", "checkout", "--force", "FETCH_HEAD");
const commit = git("rev-parse", "--short", "HEAD");

// Assemble ./Styles the same way Rock's build does: RockWeb/Styles first, then the
// Rock.Frontend.Styles sources copied over the top.
rmSync(OUT, { recursive: true, force: true });
cpSync(join(SRC, "RockWeb/Styles"), OUT, { recursive: true });
const frontend = join(SRC, "Rock.Frontend.Styles/src/styles");
if (existsSync(frontend)) {
    cpSync(frontend, OUT, { recursive: true });
}

// Compiling (including styles-v2/core.css, which Rock 19+ doesn't commit) happens in
// scripts/build.mjs.

if (withReference) {
    rmSync(REF, { recursive: true, force: true });
    const nextGen = existsSync(join(SRC, "Rock.Frontend.Styles/src/themes/RockNextGen"))
        ? "Rock.Frontend.Styles/src/themes/RockNextGen"
        : "RockWeb/Themes/RockNextGen";
    for (const [from, to] of [["RockWeb/Themes/Stark", "Stark"], [nextGen, "RockNextGen"]]) {
        if (existsSync(join(SRC, from))) cpSync(join(SRC, from), join(REF, to), { recursive: true });
    }
}

writeFileSync(join(OUT, ".rock-version"), `${version} (${commit})\n`);
console.log(`Done. ./Styles now matches RockWeb/Styles for Rock ${version} (${commit}).`);
