const { app, BrowserWindow, clipboard, dialog, ipcMain, shell, safeStorage, protocol } = require('electron');
const path = require('node:path');
const { Readable } = require('node:stream');
const fs = require('node:fs');
const fsp = fs.promises;
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { KnowledgeService } = require('./knowledge-service.cjs');
const { AIService } = require('./ai-service.cjs');

let mainWindow;
let knowledge;
let ai;
const previewCache = new Map();
const execFileAsync = promisify(execFile);

protocol.registerSchemesAsPrivileged([{ scheme: 'wow-media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 640,
    title: '哇塞-超级桌面', backgroundColor: '#090b0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      sandbox: true, nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  if (!app.isPackaged) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function emitProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('asset-progress', payload);
}

function registerHandlers() {
  ipcMain.handle('pick-assets', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'openDirectory', 'multiSelections'] });
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle('describe-paths', (_event, paths) => knowledge.describePaths(paths));
  ipcMain.handle('ingest-paths', (_event, paths) => knowledge.ingestPaths(paths));
  ipcMain.handle('list-assets', () => knowledge.listAssets());
  ipcMain.handle('list-children', (_event, parentId) => knowledge.listChildren(parentId));
  ipcMain.handle('rescan-asset', (_event, assetId) => knowledge.rescanAsset(assetId));
  ipcMain.handle('search-knowledge', (_event, input) => knowledge.searchKnowledge(input.query, input.assetIds, input.ensureCoverage));
  ipcMain.handle('read-knowledge', (_event, assetIds) => knowledge.readKnowledge(assetIds));
  ipcMain.handle('ensure-knowledge-indexed', async (_event, assetIds) => {
    for (const id of assetIds || []) {
      const asset = knowledge.getAsset(id);
      if (asset && asset.indexStatus !== 'ready') await knowledge.rescanAsset(id);
    }
    return knowledge.listAssets();
  });
  ipcMain.handle('load-workspace', () => knowledge.loadWorkspace());
  ipcMain.handle('save-workspace', (_event, workspace) => knowledge.saveWorkspace(workspace));
  ipcMain.handle('open-asset', (_event, filePath) => shell.openPath(filePath));
  ipcMain.handle('reveal-asset', (_event, filePath) => shell.showItemInFolder(filePath));
  ipcMain.handle('rename-asset', (_event, assetId, name) => knowledge.renameAsset(assetId, name));
  ipcMain.handle('trash-asset', async (_event, assetId) => {
    const asset = knowledge.getAsset(assetId);
    if (!asset) throw new Error('资料不存在');
    await shell.trashItem(asset.path);
    const removedIds = knowledge.removeAssetFromIndex(assetId);
    return { removedIds };
  });
  ipcMain.handle('copy-to-desktop', async (_event, assetId) => {
    const asset = knowledge.getAsset(assetId);
    if (!asset) throw new Error('资料不存在');
    const desktop = app.getPath('desktop');
    const parsed = path.parse(asset.name);
    let destination = path.join(desktop, asset.name);
    let suffix = 2;
    while (fs.existsSync(destination)) destination = path.join(desktop, `${parsed.name} ${suffix++}${parsed.ext}`);
    await fsp.cp(asset.path, destination, { recursive: true });
    shell.showItemInFolder(destination);
    return destination;
  });
  ipcMain.handle('get-file-icon', async (_event, filePath) => {
    if (previewCache.has(filePath)) return previewCache.get(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' }[extension];
    let dataUrl = '';
    if (mime) {
      const stat = await fsp.stat(filePath);
      if (stat.size <= 16 * 1024 * 1024) dataUrl = `data:${mime};base64,${(await fsp.readFile(filePath)).toString('base64')}`;
    } else if (process.platform === 'darwin' && ['.docx', '.doc', '.pdf', '.pages', '.rtf', '.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.mpeg', '.mpg'].includes(extension)) {
      let previewDirectory;
      try {
        previewDirectory = await fsp.mkdtemp(path.join(app.getPath('temp'), 'wow-quicklook-'));
        await execFileAsync('/usr/bin/qlmanage', ['-t', '-s', '640', '-o', previewDirectory, filePath], { timeout: 30000 });
        const thumbnailName = (await fsp.readdir(previewDirectory)).find((name) => name.toLowerCase().endsWith('.png'));
        if (thumbnailName) dataUrl = `data:image/png;base64,${(await fsp.readFile(path.join(previewDirectory, thumbnailName))).toString('base64')}`;
      } catch {}
      finally { if (previewDirectory) await fsp.rm(previewDirectory, { recursive: true, force: true }).catch(() => {}); }
    }
    previewCache.set(filePath, dataUrl);
    return dataUrl;
  });
  ipcMain.handle('get-ai-settings', () => ai.getSettings());
  ipcMain.handle('save-ai-settings', (_event, settings) => ai.saveSettings(settings));
  ipcMain.handle('test-ai-connection', () => ai.testConnection());
  ipcMain.handle('generate-ai-answer', (_event, input) => ai.generate(input));
  ipcMain.handle('generate-media', (_event, input) => ai.generateMedia(input));
  ipcMain.handle('write-clipboard', (_event, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  knowledge = new KnowledgeService(path.join(userData, 'wow-super-desktop.sqlite'), emitProgress);
  ai = new AIService(path.join(userData, 'ai-settings.json'), safeStorage);
  protocol.handle('wow-media', (request) => {
    const id = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''));
    const asset = knowledge.getAsset(id);
    if (!asset || asset.kind !== 'file') return new Response('Not found', { status: 404 });
    if (!fs.existsSync(asset.path)) return new Response('Source file not found', { status: 404 });
    const stat = fs.statSync(asset.path);
    const range = request.headers.get('range');
    const mime = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska' }[path.extname(asset.path).toLowerCase()] || 'application/octet-stream';
    let start = 0; let end = stat.size - 1; let status = 200;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) { start = match[1] ? Number(match[1]) : 0; end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1; status = 206; }
    }
    const headers = { 'Content-Type': mime, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    return new Response(Readable.toWeb(fs.createReadStream(asset.path, { start, end })), { status, headers });
  });
  registerHandlers();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
