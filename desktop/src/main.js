/**
 * @generated
 * @context Tile icons always come from the included Pages set. The Icon site URL override is gone, because a blank override on builds before 1.2.1 saved the portal default instead of the icon the user picked.
 * @decisions Every save writes DEFAULT_ICON_SITE/icons/<key>.svg. Settings keep only the portal URL and the optional Innovation Studio URL.
 * @references desktop/README.md
 * @modified 2026-11-09
 */
// Signs in through a real portal window (SSO/MFA work normally) and calls the portal API with that session.
const { app, BrowserWindow, ipcMain, shell, session, net } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { toDiscovered } = require('./discover.js');
const { summarizeRelease } = require('./update.js');

const REPO = 'Cody-HelixOps/HelixTileBuilder';
const DEFAULT_ICON_SITE = 'https://cody-helixops.github.io/HelixTileBuilder';

const PARTITION = 'persist:helix-portal';
const ICON_KEYS = require('./renderer/icons-data.js').ICONS.map((i) => i.key);

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    return { portalUrl: saved.portalUrl || '', isUrl: saved.isUrl || '' };
  } catch {
    return { portalUrl: '', isUrl: '' };
  }
}

function httpsOrigin(value, label) {
  let u;
  try { u = new URL(String(value).trim()); } catch { throw new Error(`${label} is not a valid URL.`); }
  if (u.protocol !== 'https:') throw new Error(`${label} must start with https://`);
  return u.origin;
}

function saveSettings(input) {
  const s = {
    portalUrl: input.portalUrl ? httpsOrigin(input.portalUrl, 'Portal URL') : '',
    isUrl: input.isUrl ? httpsOrigin(input.isUrl, 'Innovation Studio URL') : '',
  };
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
  return s;
}

async function portalApi(method, suffix, body) {
  const s = loadSettings();
  if (!s.portalUrl) throw new Error('Save the portal URL first.');
  const ses = session.fromPartition(PARTITION);
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    const cookies = await ses.cookies.get({ url: `${s.portalUrl}/admin/`, name: 'XSRF-TOKEN' });
    if (!cookies.length) throw new Error('Not signed in. Click "Sign in" first.');
    headers['X-XSRF-TOKEN'] = cookies[0].value;
    if (body) headers['Content-Type'] = 'application/json';
  }
  const res = await ses.fetch(`${s.portalUrl}/admin/ims-api/${suffix}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON, e.g. a login page */ }
  const loginPage = res.ok && json === null && text.length > 0;
  if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400) || loginPage) {
    throw new Error('Not signed in, or your session expired. Click "Sign in".');
  }
  if (!res.ok) throw new Error((json && (json.error || json.message)) || `Portal returned HTTP ${res.status}`);
  return json;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
const componentOf = (rec) => rec?.config?.ui_configurations?.components?.[0] || {};

function simplify(rec) {
  const c = componentOf(rec);
  return {
    id: rec.application_id,
    name: c.name || rec.name,
    description: c.description || rec.description || '',
    url: (rec.service_url || '') + (c.link_route_path || ''),
    icon: c.image_source_uri || '',
  };
}

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 980,
    minHeight: 660,
    title: 'Helix Tile Manager',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#0a0f1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:save', (_e, input) => saveSettings(input));

ipcMain.handle('auth:signin', async () => {
  const s = loadSettings();
  if (!s.portalUrl) throw new Error('Save the portal URL first.');
  try {
    await portalApi('GET', 'userinfo');
    return true; // already signed in, no window needed
  } catch { /* not signed in yet */ }
  await new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1000,
      height: 760,
      parent: mainWindow,
      title: 'Sign in to Helix Portal. This window closes by itself when you are signed in.',
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.setMenuBarVisibility(false);
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) shell.openExternal(url);
      return { action: 'deny' };
    });
    // Close the window as soon as the portal accepts the session.
    const timer = setInterval(async () => {
      try {
        await portalApi('GET', 'userinfo');
        if (!win.isDestroyed()) win.close();
      } catch { /* still signing in */ }
    }, 1500);
    win.on('closed', () => { clearInterval(timer); resolve(); });
    win.loadURL(`${s.portalUrl}/admin/#/landing`);
  });
  return true;
});

ipcMain.handle('auth:check', async () => {
  const info = await portalApi('GET', 'userinfo');
  return { user: info.full_name || info.principal_id, tenant: info.tenant_name };
});

ipcMain.handle('apps:list', async () => {
  const res = await portalApi('GET', 'custom_ui_applications?sortOrder=asc');
  return (res?.records || []).filter((r) => String(r.application_id).startsWith('custom-')).map(simplify);
});

// --- Innovation Studio discovery -------------------------------------------------------------
const BUNDLES_PATH = '/api/rx/application/datapage?dataPageType=com.bmc.arsys.rx.application.bundle.datapage.BundleDescriptorDataPageQuery&pageSize=-1&startIndex=0&includeNonLicensedBundles=true';

async function isOrigin() {
  const s = loadSettings();
  if (s.isUrl) return s.isUrl;
  const list = await portalApi('GET', 'applications?orderBy=name&sortOrder=asc&page=0');
  const rec = (list?.records || []).find((a) => a.application_id === 'IS');
  if (!rec || !rec.service_url) {
    throw new Error('Could not detect the Innovation Studio URL from your portal. Enter it under "Innovation Studio URL".');
  }
  return new URL(rec.service_url).origin;
}

async function fetchBundles(origin) {
  try {
    const res = await session.fromPartition(PARTITION).fetch(origin + BUNDLES_PATH, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      redirect: 'manual',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : null;
  } catch {
    return null;
  }
}

// Loads Innovation Studio in the signed-in session so single sign-on creates its cookies.
// The window stays hidden unless sign-in needs the user, then closes itself once connected.
async function ensureIsSession(origin) {
  const existing = await fetchBundles(origin);
  if (existing) return existing;
  await new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1000,
      height: 760,
      parent: mainWindow,
      show: false,
      title: 'Sign in to Innovation Studio. This window closes by itself when you are connected.',
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.setMenuBarVisibility(false);
    const timer = setInterval(async () => {
      if (await fetchBundles(origin)) { if (!win.isDestroyed()) win.close(); }
    }, 1500);
    const reveal = setTimeout(() => { if (!win.isDestroyed()) win.show(); }, 8000);
    win.on('closed', () => { clearInterval(timer); clearTimeout(reveal); resolve(); });
    win.loadURL(`${origin}/helix/index.html`);
  });
  const data = await fetchBundles(origin);
  if (!data) throw new Error('Could not sign in to Innovation Studio. Try again and finish the sign-in window.');
  return data;
}

ipcMain.handle('is:discover', async (_e, opts) => {
  const origin = await isOrigin();
  const bundles = await ensureIsSession(origin);
  const apps = toDiscovered(bundles, origin, !!(opts && opts.includeLibraries));
  return { origin, apps };
});

ipcMain.handle('apps:save', async (_e, input) => {
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  if (!name || name.length > 60) throw new Error('Name is required (60 characters max).');
  if (description.length > 200) throw new Error('Description is 200 characters max.');
  let dest;
  try { dest = new URL(String(input.url).trim()); } catch { throw new Error('Destination URL is not a valid URL.'); }
  if (dest.protocol !== 'https:' && dest.protocol !== 'http:') throw new Error('Destination URL must be http(s).');

  const list = await portalApi('GET', 'custom_ui_applications?sortOrder=asc');
  const records = list?.records || [];
  const editing = input.id ? records.find((r) => r.application_id === input.id) : null;
  if (input.id && !editing) throw new Error('The tile being edited no longer exists on the portal.');
  const id = input.id || `custom-${slug(name)}`;
  if (id === 'custom-') throw new Error('Name must contain letters or digits.');
  if (!input.id && records.some((r) => r.application_id === id)) {
    throw new Error(`A tile with id "${id}" already exists. Pick another name or edit that tile.`);
  }

  if (!input.iconKey || !ICON_KEYS.includes(input.iconKey)) throw new Error('Unknown icon.');
  // @context Portal tiles can only reference an https image, so the picked key always maps to an included SVG on the Pages site.
  const iconUrl = `${DEFAULT_ICON_SITE}/icons/${input.iconKey}.svg`;

  const body = {
    application_id: id,
    name,
    description,
    service_type: 'CUSTOM_UI',
    service_url: dest.origin,
    version: '1.0',
    config: {
      ui_configurations: {
        components: [{
          name,
          description,
          link_route_path: dest.pathname + dest.search + dest.hash,
          use_service_url: true,
          product_services: true,
          image_source_uri: iconUrl,
        }],
      },
    },
  };
  if (editing) await portalApi('PUT', `custom_ui_applications/${encodeURIComponent(id)}`, body);
  else await portalApi('POST', 'custom_ui_applications', body);
  return { id, iconUrl, updated: !!editing };
});

ipcMain.handle('apps:delete', async (_e, id) => {
  if (!String(id).startsWith('custom-')) throw new Error('Only custom tiles can be removed.');
  await portalApi('DELETE', `custom_ui_applications/${encodeURIComponent(id)}`);
  return true;
});

// --- Version, update check and issue reporting ---------------------------------------------------
let lastUpdate = null;

ipcMain.handle('app:info', () => ({ version: app.getVersion() }));

ipcMain.handle('app:checkUpdate', async () => {
  let res;
  try {
    res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Helix-Tile-Manager' },
    });
  } catch {
    throw new Error('Could not reach GitHub. Check your internet connection.');
  }
  if (res.status === 404) throw new Error('No release was found on GitHub.');
  if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status}.`);
  lastUpdate = summarizeRelease(await res.json(), app.getVersion(), process.platform);
  return lastUpdate;
});

ipcMain.handle('app:openUpdate', async () => {
  const url = lastUpdate && lastUpdate.downloadUrl;
  if (!url || !url.startsWith(`https://github.com/${REPO}/`)) throw new Error('Check for updates first.');
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('app:openIssues', async () => {
  const body = `App version: ${app.getVersion()}
System: ${process.platform} ${os.release()}

What happened:

What you expected:
`;
  await shell.openExternal(`https://github.com/${REPO}/issues/new?body=${encodeURIComponent(body)}`);
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
