const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { KnowledgeService, chunkText, extractTerms, parseMarkdown, stripHtml } = require('./knowledge-service.cjs');

test('chunkText applies overlap without empty chunks', () => {
  const chunks = chunkText('a'.repeat(1000), 900, 120);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].length, 900);
  assert.equal(chunks[1].length, 220);
});

test('extractTerms includes Chinese bigrams', () => {
  const terms = extractTerms('定价策略 research');
  assert.ok(terms.includes('定价'));
  assert.ok(terms.includes('策略'));
  assert.ok(terms.includes('research'));
});

test('parsers preserve useful locators', () => {
  assert.equal(parseMarkdown('# 机会\n内容')[0].locator, '机会');
  assert.equal(stripHtml('<p>核心&amp;证据</p>'), '核心&证据');
});

test('explicitly attached documents can be read without keyword overlap', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-knowledge-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const documentPath = path.join(directory, '无扩展名文档');
  fs.writeFileSync(documentPath, '这是必须被直接读取的文档正文，关键结论是本地解析成功。');
  const service = new KnowledgeService(path.join(directory, 'knowledge.sqlite'));
  const result = await service.ingestPaths([documentPath]);
  const assetId = result.roots[0].id;

  const direct = service.readKnowledge([assetId]);
  assert.equal(direct.length, 1);
  assert.match(direct[0].text, /本地解析成功/);

  const covered = service.searchKnowledge('完全不相关的词', [assetId], true);
  assert.equal(covered.length, 1);
  assert.match(covered[0].text, /文档正文/);
});
