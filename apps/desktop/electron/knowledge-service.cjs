const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const mammoth = require('mammoth');

const TEXT_EXTENSIONS = new Set([
  '', '.txt', '.md', '.markdown', '.html', '.htm', '.csv', '.json', '.jsonl',
  '.yaml', '.yml', '.xml', '.rtf', '.log', '.ini', '.conf', '.toml',
  '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.py', '.sh', '.sql',
]);
const SUPPORTED = new Set(['.pdf', '.docx', ...TEXT_EXTENSIONS]);

class KnowledgeService {
  constructor(dbPath, onProgress = () => {}) {
    this.db = new DatabaseSync(dbPath);
    this.onProgress = onProgress;
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY, parent_id TEXT, path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL, kind TEXT NOT NULL, extension TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0, modified_at REAL NOT NULL DEFAULT 0,
        index_status TEXT NOT NULL DEFAULT 'pending', child_count INTEGER NOT NULL DEFAULT 0,
        error TEXT, FOREIGN KEY(parent_id) REFERENCES assets(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, content TEXT NOT NULL,
        locator TEXT NOT NULL, page INTEGER, heading TEXT,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        chunk_id UNINDEXED, asset_id UNINDEXED, content, tokenize='unicode61'
      );
      CREATE TABLE IF NOT EXISTS workspace_state (
        id INTEGER PRIMARY KEY CHECK(id = 1), json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
        updated_at REAL NOT NULL
      );
    `);
  }

  assetFromRow(row) {
    return row ? {
      id: row.id, parentId: row.parent_id || undefined, path: row.path, name: row.name,
      kind: row.kind, extension: row.extension, size: row.size, modifiedAt: row.modified_at,
      indexStatus: row.index_status, childCount: row.child_count, error: row.error || undefined,
    } : null;
  }

  listAssets(limit = 500) {
    return this.db.prepare('SELECT * FROM assets ORDER BY modified_at DESC LIMIT ?').all(limit).map((row) => this.assetFromRow(row));
  }

  listChildren(parentId) {
    return this.db.prepare('SELECT * FROM assets WHERE parent_id = ? ORDER BY kind DESC, name COLLATE NOCASE').all(parentId).map((row) => this.assetFromRow(row));
  }

  getAsset(assetId) {
    return this.assetFromRow(this.db.prepare('SELECT * FROM assets WHERE id=?').get(assetId));
  }

  async rescanAsset(assetId) {
    const asset = this.getAsset(assetId);
    if (!asset) throw new Error('资料不存在');
    return this.processTree(asset);
  }

  renameAsset(assetId, nextName) {
    const asset = this.getAsset(assetId);
    if (!asset) throw new Error('资料不存在');
    if (!nextName || /[\\/:*?"<>|]/.test(nextName) || nextName === '.' || nextName === '..') throw new Error('名称包含非法字符');
    const nextPath = path.join(path.dirname(asset.path), nextName);
    if (fs.existsSync(nextPath)) throw new Error('同名文件或文件夹已存在');
    fs.renameSync(asset.path, nextPath);
    const rows = this.db.prepare('SELECT id,path FROM assets WHERE path=? OR path LIKE ? ORDER BY length(path)').all(asset.path, `${asset.path}${path.sep}%`);
    this.db.exec('BEGIN');
    try {
      for (const row of rows) {
        const updatedPath = row.path === asset.path ? nextPath : `${nextPath}${row.path.slice(asset.path.length)}`;
        this.db.prepare('UPDATE assets SET path=?,name=? WHERE id=?').run(updatedPath, path.basename(updatedPath), row.id);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      try { fs.renameSync(nextPath, asset.path); } catch {}
      throw error;
    }
    return { previousPath: asset.path, assets: rows.map((row) => this.getAsset(row.id)) };
  }

  async describePaths(paths) {
    const results = [];
    for (const inputPath of paths) {
      const resolved = path.resolve(inputPath);
      const stat = await fsp.stat(resolved);
      results.push({ path: resolved, name: path.basename(resolved), kind: stat.isDirectory() ? 'folder' : 'file', size: stat.size, modifiedAt: stat.mtimeMs, extension: stat.isDirectory() ? '' : path.extname(resolved).toLowerCase() });
    }
    return results;
  }

  upsertAsset(filePath, parentId) {
    const stat = fs.statSync(filePath);
    const existing = this.db.prepare('SELECT id FROM assets WHERE path = ?').get(filePath);
    const id = existing?.id || crypto.randomUUID();
    const kind = stat.isDirectory() ? 'folder' : 'file';
    const extension = kind === 'file' ? path.extname(filePath).toLowerCase() : '';
    const status = kind === 'file' && !SUPPORTED.has(extension) ? 'unsupported' : 'pending';
    this.db.prepare(`INSERT INTO assets(id,parent_id,path,name,kind,extension,size,modified_at,index_status)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET parent_id=excluded.parent_id,name=excluded.name,
      kind=excluded.kind,extension=excluded.extension,size=excluded.size,modified_at=excluded.modified_at,
      index_status=CASE WHEN assets.modified_at<>excluded.modified_at THEN excluded.index_status ELSE assets.index_status END,error=NULL`).run(
        id, parentId || null, filePath, path.basename(filePath), kind, extension, stat.size, stat.mtimeMs, status,
      );
    return this.assetFromRow(this.db.prepare('SELECT * FROM assets WHERE id = ?').get(id));
  }

  setStatus(id, status, error = null) {
    this.db.prepare('UPDATE assets SET index_status = ?, error = ? WHERE id = ?').run(status, error, id);
    const asset = this.assetFromRow(this.db.prepare('SELECT * FROM assets WHERE id = ?').get(id));
    this.onProgress({ type: 'asset', asset });
    return asset;
  }

  async ingestPaths(paths) {
    const roots = [];
    for (const input of paths) {
      const filePath = path.resolve(input);
      const asset = this.upsertAsset(filePath, null);
      roots.push(asset);
      await this.processTree(asset);
    }
    return { roots, assets: this.listAssets() };
  }

  async processTree(asset) {
    if (asset.kind === 'file') return this.processFile(asset);
    this.setStatus(asset.id, 'scanning');
    const queue = [{ dir: asset.path, parentId: asset.id }];
    const files = [];
    let childCount = 0;
    while (queue.length) {
      const current = queue.shift();
      const entries = (await fsp.readdir(current.dir, { withFileTypes: true })).filter((entry) => !entry.name.startsWith('.')).slice(0, 1000);
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const childPath = path.join(current.dir, entry.name);
        const child = this.upsertAsset(childPath, current.parentId);
        childCount += 1;
        if (entry.isDirectory()) queue.push({ dir: childPath, parentId: child.id });
        else files.push(child);
      }
    }
    this.db.prepare('UPDATE assets SET child_count = ?, index_status = ? WHERE id = ?').run(childCount, 'processing', asset.id);
    let completed = 0;
    for (const file of files) {
      await this.processFile(file);
      completed += 1;
      this.onProgress({ type: 'folder-progress', assetId: asset.id, completed, total: files.length });
    }
    return this.setStatus(asset.id, 'ready');
  }

  async processFile(asset) {
    if (!SUPPORTED.has(asset.extension)) return this.setStatus(asset.id, 'unsupported');
    this.setStatus(asset.id, 'processing');
    try {
      const sections = await this.parseFile(asset.path, asset.extension);
      const deleteIds = this.db.prepare('SELECT id FROM chunks WHERE asset_id = ?').all(asset.id);
      const deleteFts = this.db.prepare('DELETE FROM chunks_fts WHERE chunk_id = ?');
      for (const row of deleteIds) deleteFts.run(row.id);
      this.db.prepare('DELETE FROM chunks WHERE asset_id = ?').run(asset.id);
      const insertChunk = this.db.prepare('INSERT INTO chunks(id,asset_id,content,locator,page,heading) VALUES(?,?,?,?,?,?)');
      const insertFts = this.db.prepare('INSERT INTO chunks_fts(chunk_id,asset_id,content) VALUES(?,?,?)');
      this.db.exec('BEGIN');
      try {
        for (const section of sections) {
          for (const chunk of chunkText(section.text)) {
            const id = crypto.randomUUID();
            insertChunk.run(id, asset.id, chunk, section.locator, section.page || null, section.heading || null);
            insertFts.run(id, asset.id, chunk);
          }
        }
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
      return this.setStatus(asset.id, 'ready');
    } catch (error) {
      return this.setStatus(asset.id, 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  async parseFile(filePath, extension) {
    if (extension === '.pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const data = new Uint8Array(await fsp.readFile(filePath));
      const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
      const sections = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        sections.push({ text: content.items.map((item) => item.str || '').join(' '), locator: `第 ${pageNumber} 页`, page: pageNumber });
      }
      return sections;
    }
    if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer: await fsp.readFile(filePath) });
      return [{ text: result.value, locator: '正文' }];
    }
    const text = await fsp.readFile(filePath, 'utf8');
    if (extension === '.md' || extension === '.markdown') return parseMarkdown(text);
    if (extension === '.html' || extension === '.htm') return [{ text: stripHtml(text), locator: '页面正文' }];
    return [{ text, locator: '全文' }];
  }

  resolveScope(assetIds = []) {
    if (!assetIds.length) return this.listAssets(10000).filter((asset) => asset.kind === 'file').map((asset) => asset.id);
    const resolved = new Set(assetIds);
    const queue = [...assetIds];
    const stmt = this.db.prepare('SELECT id FROM assets WHERE parent_id = ?');
    while (queue.length) {
      for (const child of stmt.all(queue.shift())) if (!resolved.has(child.id)) { resolved.add(child.id); queue.push(child.id); }
    }
    return [...resolved];
  }

  searchKnowledge(query, assetIds = [], ensureCoverage = false) {
    const scope = this.resolveScope(assetIds);
    if (!scope.length) return [];
    const placeholders = scope.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT c.*,a.name source,a.path source_path FROM chunks c JOIN assets a ON a.id=c.asset_id WHERE c.asset_id IN (${placeholders}) ORDER BY c.rowid DESC LIMIT 300`).all(...scope);
    const terms = extractTerms(query).slice(0, 48);
    const scored = rows.map((row) => {
      const content = row.content.toLowerCase();
      const filename = row.source.toLowerCase();
      let score = 0;
      for (const term of terms) { if (content.includes(term)) score += 1; if (filename.includes(term)) score += 4; }
      return { chunkId: row.id, assetId: row.asset_id, source: row.source, sourcePath: row.source_path, locator: row.locator, page: row.page || undefined, text: row.content, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    if (!ensureCoverage) return scored.slice(0, 5);
    const result = [];
    const used = new Set();
    for (const item of scored) if (!used.has(item.assetId) && used.size < 8) { result.push(item); used.add(item.assetId); }
    // Explicitly scoped documents must still contribute evidence when the user's
    // wording does not overlap with their text. Keyword scoring ranks evidence;
    // it must not make an attached document disappear entirely.
    for (const row of rows) {
      if (used.size >= 8) break;
      if (!used.has(row.asset_id)) {
        result.push(this.citationFromRow(row, 0));
        used.add(row.asset_id);
      }
    }
    for (const item of scored) if (result.length < 8 && !result.includes(item)) result.push(item);
    return result;
  }

  citationFromRow(row, score = 1) {
    return {
      chunkId: row.id, assetId: row.asset_id, source: row.source,
      sourcePath: row.source_path, locator: row.locator,
      page: row.page || undefined, text: row.content, score,
    };
  }

  readKnowledge(assetIds = [], maxAssets = 12, maxCharsPerAsset = 16000, maxTotalChars = 60000) {
    const scope = this.resolveScope(assetIds);
    if (!scope.length) return [];
    const placeholders = scope.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT c.*,a.name source,a.path source_path
      FROM chunks c JOIN assets a ON a.id=c.asset_id
      WHERE c.asset_id IN (${placeholders}) ORDER BY a.name COLLATE NOCASE,c.rowid ASC`).all(...scope);
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.asset_id)) grouped.set(row.asset_id, []);
      grouped.get(row.asset_id).push(row);
    }
    const result = [];
    let totalChars = 0;
    for (const assetRows of grouped.values()) {
      if (result.length >= maxAssets || totalChars >= maxTotalChars) break;
      let text = '';
      for (const row of assetRows) {
        const remaining = Math.min(maxCharsPerAsset - text.length, maxTotalChars - totalChars - text.length);
        if (remaining <= 0) break;
        const separator = text ? '\n\n' : '';
        text += separator + row.content.slice(0, Math.max(0, remaining - separator.length));
      }
      if (!text.trim()) continue;
      const first = assetRows[0];
      const last = assetRows[assetRows.length - 1];
      result.push({
        chunkId: `document:${first.asset_id}`, assetId: first.asset_id,
        source: first.source, sourcePath: first.source_path,
        locator: first.locator === last.locator ? first.locator : `${first.locator} – ${last.locator}`,
        page: first.page || undefined, text: text.trim(), score: 1,
      });
      totalChars += text.length;
    }
    return result;
  }

  loadWorkspace() {
    const row = this.db.prepare('SELECT json,revision,updated_at FROM workspace_state WHERE id=1').get();
    return row ? { ...JSON.parse(row.json), revision: row.revision, updatedAt: row.updated_at } : null;
  }

  saveWorkspace(workspace) {
    const revision = Number(workspace.revision || 0);
    const current = this.db.prepare('SELECT revision FROM workspace_state WHERE id=1').get();
    if (current && current.revision > revision) return { saved: false, reason: 'stale', revision: current.revision };
    const updatedAt = Date.now();
    this.db.prepare(`INSERT INTO workspace_state(id,json,revision,updated_at) VALUES(1,?,?,?)
      ON CONFLICT(id) DO UPDATE SET json=excluded.json,revision=excluded.revision,updated_at=excluded.updated_at`).run(JSON.stringify(workspace), revision, updatedAt);
    return { saved: true, revision, updatedAt };
  }

  removeAssetFromIndex(assetId) {
    const ids = [assetId];
    const queue = [assetId];
    const childStmt = this.db.prepare('SELECT id FROM assets WHERE parent_id=?');
    while (queue.length) for (const child of childStmt.all(queue.shift())) { ids.push(child.id); queue.push(child.id); }
    const deleteFts = this.db.prepare('DELETE FROM chunks_fts WHERE asset_id=?');
    for (const id of ids) deleteFts.run(id);
    this.db.prepare('DELETE FROM assets WHERE id=?').run(assetId);
    return ids;
  }
}

function chunkText(input, size = 900, overlap = 120) {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const chunks = [];
  for (let start = 0; start < text.length; start += size - overlap) chunks.push(text.slice(start, start + size));
  return chunks;
}

function parseMarkdown(text) {
  const sections = [];
  let heading = '正文';
  let buffer = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+)/);
    if (match) { if (buffer.length) sections.push({ text: buffer.join('\n'), locator: heading, heading }); heading = match[1].trim(); buffer = []; }
    else buffer.push(line);
  }
  if (buffer.length) sections.push({ text: buffer.join('\n'), locator: heading, heading });
  return sections;
}

function stripHtml(text) {
  return text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function extractTerms(query) {
  const lower = query.toLowerCase();
  const terms = new Set(lower.match(/[a-z0-9][a-z0-9._-]{1,}/g) || []);
  for (const block of lower.match(/[\u4e00-\u9fff]+/g) || []) {
    for (let index = 0; index < block.length - 1; index += 1) terms.add(block.slice(index, index + 2));
    for (let index = 0; index < block.length - 3; index += 2) terms.add(block.slice(index, index + 4));
  }
  return [...terms];
}

module.exports = { KnowledgeService, chunkText, extractTerms, parseMarkdown, stripHtml };
