# Rock Themes

Website themes for Rock RMS (legacy LESS and NextGen Sass), plus the NextGen core CSS
that Rock's Git repository doesn't track.

The repo root mirrors `RockWeb/`, so theme imports such as
`@import "../../../Styles/_rock-core.less";` resolve here exactly as they do on the server,
and compiled CSS lands where Rock expects it.

```
.rock-version          Rock release to build against. Must match the target server.
scripts/sync-rock.mjs  pulls Rock's style sources for that release into ./Styles
scripts/build.mjs      compiles CSS in place
Themes/<Name>/         your themes (LESS or Sass), same layout as RockWeb/Themes
Styles/                Rock's core styles for .rock-version (gitignored)
```

## Commands

```sh
npm install              # installs less + sass, then runs sync
npm run build            # compiles core.css and every theme
npm run build -- MyTheme # core + one theme
npm run sync:reference   # optional: Rock's Stark and RockNextGen themes in ./reference
```

The build exits with an error if anything fails to compile, so a broken theme fails CI.

## What gets compiled

- **`Styles/styles-v2/core.css`**, from Rock's `core.scss`. NextGen themes load it with
  `@import "../../../Styles/styles-v2/core.css"`. Rock 19+ generates it during its own build
  and doesn't commit it, so a server deployed from the Rock repo won't have it.
- **`Themes/<Name>/Styles/*.css`**, next to each `.less` / `.scss` file not starting with `_`:
  - LESS: minified, with `math: always`, like dotless (Rock's server compiler)
  - Sass: expanded, with Sass 1.77.6, like Rock's own NextGen build

Compiled theme CSS is gitignored by name (`theme.css`, `bootstrap.css`, `checkin-theme*.css`).
If a theme compiles other files, add them to `.gitignore`.

## What ships to a server

Copy these over `RockWeb/`, keeping their paths:

- `Themes/<Name>/` for each theme
- `Styles/styles-v2/core.css` and `Styles/styles-v2/icons/` (Rock adds `@import`s for the
  icon stylesheets at request time; they're untracked in Rock's repo too)

**Don't copy all of `./Styles`.** The rest is Rock's own source, which the server already has
from its Rock install. Copying it would overwrite Rock's files.

**Build against the same Rock version the server runs**, since `core.css` must match it.

## Legacy themes and `.nocompile`

At startup, and after every Rock update, Rock recompiles any LESS theme whose `.css` is
older than its sources or than `RockWeb/Styles`. That would replace the CSS built here.
`Themes/LegacyTheme/Styles/.nocompile` tells Rock to leave the deployed CSS alone.

The trade-off is that Rock's Theme Styler can't recompile that theme. To let Rock compile a
legacy theme on the server instead, delete its `.nocompile` file.

NextGen themes don't need one. Rock never compiles Sass; it serves `theme.css` as-is and
adds `theme.json` settings and custom overrides at request time.

## Upgrading Rock

Set `.rock-version` to the new tag (e.g. `19.4.4`), then run `npm run sync && npm run build`.
Deploy the new `core.css` together with the Rock upgrade.

## CI

`.github/workflows/build.yml` builds on every push and pull request and uploads exactly the
files listed under "What ships to a server" as an artifact, laid out like `RockWeb/`.
A deploy job sketch (self-hosted Windows runner + robocopy) is in the comments.
Commit `package-lock.json` after your first `npm install` and switch the workflow to `npm ci`.
