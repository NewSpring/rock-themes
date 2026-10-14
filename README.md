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

Copy `Themes/<Name>/` for each theme over `RockWeb/Themes/<Name>/`, keeping paths — built
CSS and static assets only, not the `.less` / `.scss` sources that produced them. The CI
artifact already drops those (see `build.yml`).

**Don't copy `./Styles` at all.** `Styles/styles-v2/core.css` and `Styles/styles-v2/icons/`
are Rock's own NextGen core styles, and the rest is Rock's other source — the Rock install
on the target server already has all of it. Copying any of it would overwrite Rock's files.

**Build against the same Rock version the server runs**, since theme CSS compiled here must
match it.

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
Commit `package-lock.json` after your first `npm install` and switch the workflow to `npm ci`.

## Deploy

Each server environment gets its own branch (e.g. `beta`, `production`). Pushing to that
branch runs `.github/workflows/deploy.yml`, which builds the themes on a GitHub-hosted runner,
then deploys the artifact with robocopy from a self-hosted runner installed on that
environment's VM. No manual step, and no inbound ports opened on the VM.

### Register a runner on each VM (one time)

1. Repo **Settings > Actions > Runners > New self-hosted runner**, choose Windows / x64, and
   run the download/extract commands it shows in an admin PowerShell on the VM.
2. Configure it with the label `<branch>-rock` and install it as a service:
   ```powershell
   .\config.cmd --url https://github.com/NewSpring/rock-themes --token <TOKEN> --labels beta-rock --runasservice --windowslogonaccount "DOMAIN\svc-gh-runner"
   ```
   (`production-rock` on the production VM.)
3. Give the service account modify rights on the RockWeb folder (default
   `D:\Rock\RockWeb`; override with a `DEPLOY_PATH` repo variable).

To add an environment, add its branch to `deploy.yml` and register a runner with the
matching label.

### Security

This repo is public, so keep outsiders from running code on the VMs:

- `deploy.yml` triggers only on `push` to the environment branches, never `pull_request`.
- Set **Settings > Actions > General > Fork pull request workflows** to require approval for
  all outside collaborators.
- Restrict the runner (or its runner group) to this repo.
- Protect the environment branches so only trusted people can push or merge to them.
