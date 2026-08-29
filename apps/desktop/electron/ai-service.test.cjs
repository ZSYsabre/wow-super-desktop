const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AIService } = require('./ai-service.cjs');

const safeStorage = {
  isEncryptionAvailable: () => true,
  decryptString: () => '',
  encryptString: (value) => Buffer.from(value),
};

test('migrates an invalid legacy DeepSeek model name', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-ai-settings-'));
  const settingsPath = path.join(directory, 'ai.json');
  try {
    fs.writeFileSync(settingsPath, JSON.stringify({ provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek' }));
    const service = new AIService(settingsPath, safeStorage);
    assert.equal(service.getSettings().model, 'deepseek-v4-flash');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps currently supported DeepSeek model names', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-ai-settings-'));
  const settingsPath = path.join(directory, 'ai.json');
  try {
    fs.writeFileSync(settingsPath, JSON.stringify({ provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro' }));
    const service = new AIService(settingsPath, safeStorage);
    assert.equal(service.getSettings().model, 'deepseek-v4-pro');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
