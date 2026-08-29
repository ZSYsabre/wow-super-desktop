const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('desktop', {
  pickAssets: () => invoke('pick-assets'),
  describePaths: (paths) => invoke('describe-paths', paths),
  ingestPaths: (paths) => invoke('ingest-paths', paths),
  listAssets: () => invoke('list-assets'),
  listChildren: (parentId) => invoke('list-children', parentId),
  rescanAsset: (assetId) => invoke('rescan-asset', assetId),
  ensureKnowledgeIndexed: (assetIds) => invoke('ensure-knowledge-indexed', assetIds),
  searchKnowledge: (input) => invoke('search-knowledge', input),
  readKnowledge: (assetIds) => invoke('read-knowledge', assetIds),
  loadWorkspace: () => invoke('load-workspace'),
  saveWorkspace: (workspace) => invoke('save-workspace', workspace),
  openAsset: (filePath) => invoke('open-asset', filePath),
  revealAsset: (filePath) => invoke('reveal-asset', filePath),
  renameAsset: (assetId, name) => invoke('rename-asset', assetId, name),
  trashAsset: (assetId) => invoke('trash-asset', assetId),
  copyToDesktop: (assetId) => invoke('copy-to-desktop', assetId),
  getFileIcon: (filePath) => invoke('get-file-icon', filePath),
  getAISettings: () => invoke('get-ai-settings'),
  saveAISettings: (settings) => invoke('save-ai-settings', settings),
  testAIConnection: () => invoke('test-ai-connection'),
  generateAIAnswer: (input) => invoke('generate-ai-answer', input),
  generateMedia: (input) => invoke('generate-media', input),
  writeClipboard: (text) => invoke('write-clipboard', text),
  onAssetProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('asset-progress', handler);
    return () => ipcRenderer.removeListener('asset-progress', handler);
  },
  listenForDrops: (callback) => {
    const dragover = (event) => event.preventDefault();
    const handler = (event) => {
      event.preventDefault();
      const paths = [...event.dataTransfer.files].map((file) => webUtils.getPathForFile(file)).filter(Boolean);
      if (!paths.length) return;
      const target = event.target instanceof Element ? event.target : document.elementFromPoint(event.clientX, event.clientY);
      const quickChatDrop = target?.closest('.quick-chat-drawer') || event.composedPath().some((item) => item instanceof Element && item.matches('.quick-chat-drawer'));
      if (quickChatDrop) {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('quick-chat-file-drop', { detail: { paths } }));
        return;
      }
      callback(paths, { x: event.clientX, y: event.clientY });
    };
    window.addEventListener('dragover', dragover, true);
    window.addEventListener('drop', handler, true);
    return () => { window.removeEventListener('dragover', dragover, true); window.removeEventListener('drop', handler, true); };
  },
});
