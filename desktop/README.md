# Helix Tile Manager (desktop)

Electron app for Windows and macOS that creates, edits and removes custom application tiles on a
Helix Portal. 72 generated icons, live tile preview, no scripts.

## Use

1. Enter your **Portal URL** (for example `https://mytenant-itom-demo.onbmc.com`).
2. Enter your **Icon site URL**: the GitHub Pages site from `../docs` (it hosts `icons/*.svg`).
   Leave it empty to use the default portal icon.
3. Click **Save and sign in**. A window opens the portal; sign in with SSO/MFA as usual, then close it.
4. Optional: click **Discover applications** to list the Innovation Studio apps deployed in your environment (the host is detected from your portal, or set **Innovation Studio URL**). **Use URL** fills the tile with the app's Deployed Application URL (`<IS host>/helix/index.html#/<bundle id>`). Tick **Include libraries** to list non-application bundles too.
5. Fill in name, description and destination URL, pick an icon, click **Create tile**.
6. **Your custom tiles** lists existing tiles with Edit (name, description, link, icon) and Remove.

The user needs a portal role that can manage custom applications (Administrator works).
The app stores only the two URLs; it never sees or stores a password.

## Why icons need a website

The portal accepts only an http(s) URL for a tile icon, so the icons are served from your Pages site.
The tile icon URL is `<Icon site URL>/icons/<icon>.svg`. Keep `icons/` in place after tiles exist.

## Run and build

```bash
npm install
npm start            # run from source
npm run dist:win     # dist/Helix-Tile-Manager-win.exe (portable, no installer)
npm run dist:mac     # universal .dmg (Apple silicon + Intel), must be run on macOS
```

`../.github/workflows/build.yml` builds both on GitHub runners (Actions > Build desktop installers > Run workflow),
which is how to get the `.dmg` without a Mac. The builds are unsigned: Windows SmartScreen and macOS Gatekeeper
warn on first launch (macOS: right-click > Open).

## Icons

`src/renderer/icons-data.js` is a copy of `../docs/icons-data.js`. Edit `../docs/icons-data.js`, copy it
over, and run `node build-icons.js` there to regenerate the hosted SVGs.
