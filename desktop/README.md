# Helix Tile Manager (desktop)

Electron app for Windows and macOS that creates, edits and removes custom application tiles on a
Helix Portal. 72 generated icons, live tile preview, no scripts.

## Use

1. Enter your **Portal URL** (for example `https://mytenant-itom-demo.onbmc.com`).
2. Click **Save and sign in**. A window opens the portal; sign in with SSO/MFA as usual, then close it.
3. Optional: click **Discover applications** to list the Innovation Studio apps deployed in your environment (the host is detected from your portal, or set **Innovation Studio URL**). **Use URL** fills the tile with the app's Deployed Application URL (`<IS host>/helix/index.html#/<bundle id>`). Tick **Include libraries** to list non-application bundles too.
4. Fill in name, description and destination URL, pick an icon, click **Create tile**.
   Optional: set **Icon site URL** under **Pick an icon** to host the icons on your own site.
5. **Your custom tiles** lists existing tiles with Edit (name, description, link, icon) and Remove.

The sign-in window closes by itself once the portal accepts the session. If a valid session already exists, no window opens.

## Updates and support

The footer shows the app version, checks the latest GitHub release at startup (and on **Check for updates**), and offers a
**Download update** link for your platform when a newer version exists. **Report an issue on GitHub** opens a new issue
with the app version and operating system prefilled (no portal URL or other environment details).

The user needs a portal role that can manage custom applications (Administrator works).
The app stores only the two URLs; it never sees or stores a password.

## Why icons need a website

The portal accepts only an http(s) URL for a tile icon, so the icons are served from a website.
By default that is the project's Pages site (`DEFAULT_ICON_SITE` in `src/main.js`, built from `../docs`). **Icon site URL** overrides it.
The tile icon URL is `<icon site>/icons/<icon>.svg`. Keep `icons/` in place after tiles exist.

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
