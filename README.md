# Helix Tile Manager

Create custom application tiles on a Helix Portal from a Windows or macOS app.

| Folder | What it is |
|---|---|
| `docs/` | The GitHub Pages site: landing page with download links and instructions, the 72 hosted icons (`docs/icons/`). |
| `desktop/` | The Electron desktop app (source). |
| `.github/workflows/build.yml` | GitHub Actions workflow that builds the Windows `.exe` and a universal (Apple silicon + Intel) macOS `.dmg` and publishes them as a Release when a `v*` tag is pushed. |

## Publish (once)

1. Create a **public** GitHub repo named `helix-tile-manager` (any name works; the download links follow the repo name)
   and push the contents of this folder to `main`.
2. Repo **Settings > Pages**: Source = *Deploy from a branch*, Branch = `main`, folder = `/docs`.
   The site appears at `https://<user>.github.io/<repo>/`.
3. Build and publish the installers by pushing a version tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

   The workflow builds on Windows and macOS runners and attaches `Helix-Tile-Manager-win.exe` and
   `Helix-Tile-Manager-mac.dmg` to a release. The site's download buttons point at the latest release
   (`/releases/latest/download/<file>`), so they work without edits.

To build only, run the workflow manually from the **Actions** tab; the installers are attached to the run.

## Users

Send them the Pages URL. The page explains the steps. Icons load from the project's Pages site by default; **Icon site URL** is an optional override.

## Notes

- Builds are unsigned, so Windows SmartScreen and macOS Gatekeeper warn on first launch (the page explains how to continue).
- Edit icons in `docs/icons-data.js`, run `node build-icons.js` in `docs/`, and copy `docs/icons-data.js` to
  `desktop/src/renderer/icons-data.js`. Do not rename or remove files in `docs/icons/` after tiles exist.
