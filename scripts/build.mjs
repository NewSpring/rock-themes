#!/usr/bin/env node
// Compiles CSS in place, the same places Rock's own build puts it:
//
//   Styles/styles-v2/core.css     from Styles/styles-v2/core.scss (Rock 19+; Rock 18 ships
//                                 it prebuilt). Rock's repo doesn't track this file.
//   Themes/<Name>/Styles/*.css    from each *.less / *.scss in that folder not starting with "_"
//
// Usage:  node scripts/build.mjs                  core + all themes
//         node scripts/build.mjs MyTheme Other    core + only these themes
//
// Run `npm run sync` first so ./Styles holds Rock's core sources for .rock-version.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import less from "less";
import * as sass from "sass";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = join(ROOT, "Styles");
const THEMES = join(ROOT, "Themes");

const onlyThemes = process.argv.slice(2).filter(a => !a.startsWith("--"));
const errors = [];
const rel = p => relative(ROOT, p);
const log = msg => console.log(`  ${msg}`);

if (!existsSync(join(STYLES, "styles-v2"))) {
    console.error("./Styles is missing Rock's core styles. Run `npm run sync` first.");
    process.exit(1);
}

// 1. NextGen core ------------------------------------------------------------
console.log("Core styles");
const coreDir = join(STYLES, "styles-v2");
for (const file of findFiles(coreDir, f => f.endsWith(".scss") && !baseName(f).startsWith("_") && !f.includes("@Archive"))) {
    compileSass(file, file.replace(/\.scss$/, ".css"));
}
if (!existsSync(join(coreDir, "core.css"))) {
    errors.push("Styles/styles-v2/core.css was not produced.");
}

// 2. Themes ------------------------------------------------------------------
const themeNames = existsSync(THEMES)
    ? readdirSync(THEMES).filter(n => statSync(join(THEMES, n)).isDirectory() && !n.startsWith("."))
    : [];
for (const name of onlyThemes) {
    if (!themeNames.includes(name)) errors.push(`Theme not found: Themes/${name}`);
}

for (const name of themeNames.filter(n => onlyThemes.length === 0 || onlyThemes.includes(n))) {
    const stylesDir = join(THEMES, name, "Styles");
    if (!existsSync(stylesDir)) continue;
    console.log(`Theme: ${name}`);

    // Like Rock: only the top level of Styles/, and only files not starting with "_".
    for (const f of readdirSync(stylesDir).filter(f => !f.startsWith("_"))) {
        const input = join(stylesDir, f);
        if (f.endsWith(".less")) await compileLess(input, input.replace(/\.less$/, ".css"));
        else if (f.endsWith(".scss")) compileSass(input, input.replace(/\.scss$/, ".css"));
    }
}

// ----------------------------------------------------------------------------
const versionFile = join(STYLES, ".rock-version");
const rockVersion = existsSync(versionFile) ? readFileSync(versionFile, "utf8").trim() : "unknown";

if (errors.length) {
    console.error(`\nBuild failed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
}
console.log(`\nBuilt against Rock ${rockVersion}.`);

// ----------------------------------------------------------------------------

async function compileLess(input, output) {
    try {
        const result = await less.render(readFileSync(input, "utf8"), {
            filename: input,
            // Matches dotless, Rock's server compiler: always evaluate math, minify output.
            math: "always",
            compress: true,
        });
        writeFileSync(output, result.css);
        log(`${rel(input)} -> ${rel(output)}`);
    } catch (e) {
        errors.push(`${rel(input)}: ${e.message}${e.filename ? ` (${rel(e.filename)}:${e.line})` : ""}`);
    }
}

function compileSass(input, output) {
    try {
        // Rock's build uses sass 1.77.6 with expanded output. Plain-CSS imports such as
        // @import "../../../Styles/styles-v2/core.css" stay as runtime @imports.
        const result = sass.compile(input, { style: "expanded", sourceMap: false, quietDeps: true });
        writeFileSync(output, result.css);
        log(`${rel(input)} -> ${rel(output)}`);
    } catch (e) {
        errors.push(`${rel(input)}: ${e.message}`);
    }
}

function baseName(p) {
    return p.split(/[\\/]/).pop();
}

function findFiles(dir, match) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = join(dir, e.name);
        return e.isDirectory() ? findFiles(p, match) : match(p) ? [p] : [];
    });
}
