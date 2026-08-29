const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');

const DEFAULT_INSTRUCTIONS = '仅根据提供的资料证据回答。重要判断必须使用 [1][2] 标记来源；证据不足时明确说明，不得编造。';
const DEFAULT_QUICK_INSTRUCTIONS = '你是一位专业、清晰、有洞察力的通用思考助手。优先给出直接答案，需要时再补充步骤和建议。';
const DEEPSEEK_DEFAULTS = { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' };
const DEEPSEEK_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-v4-flash-vision-exp']);
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };

class AIService {
  constructor(settingsPath, safeStorage) {
    this.settingsPath = settingsPath;
    this.safeStorage = safeStorage;
  }

  readRaw() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      raw.provider ||= DEEPSEEK_DEFAULTS.provider;
      if (raw.provider === 'deepseek') {
        if (!raw.baseUrl || /api\.openai\.com/i.test(raw.baseUrl)) raw.baseUrl = DEEPSEEK_DEFAULTS.baseUrl;
        if (!DEEPSEEK_MODELS.has(raw.model)) raw.model = DEEPSEEK_DEFAULTS.model;
      }
      return raw;
    }
    catch { return { ...DEEPSEEK_DEFAULTS, instructions: DEFAULT_INSTRUCTIONS, quickInstructions: DEFAULT_QUICK_INSTRUCTIONS }; }
  }

  resolveKey(raw = this.readRaw()) {
    const envKey = raw.provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
    if (envKey) return envKey;
    if (!raw.encryptedKey || !this.safeStorage.isEncryptionAvailable()) return '';
    try { return this.safeStorage.decryptString(Buffer.from(raw.encryptedKey, 'base64')); } catch { return ''; }
  }

  getSettings() {
    const raw = this.readRaw();
    const key = this.resolveKey(raw);
    return {
      provider: raw.provider || DEEPSEEK_DEFAULTS.provider, baseUrl: raw.baseUrl || DEEPSEEK_DEFAULTS.baseUrl,
      model: raw.model || DEEPSEEK_DEFAULTS.model, instructions: raw.instructions || DEFAULT_INSTRUCTIONS,
      quickInstructions: raw.quickInstructions || DEFAULT_QUICK_INSTRUCTIONS,
      configured: Boolean(key), keyHint: key ? `${key.slice(0, 3)}••••${key.slice(-4)}` : '',
      encryptionAvailable: this.safeStorage.isEncryptionAvailable(),
      usingEnvironmentKey: Boolean(raw.provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY),
    };
  }

  saveSettings(input) {
    const current = this.readRaw();
    const next = {
      provider: input.provider || current.provider || DEEPSEEK_DEFAULTS.provider,
      baseUrl: String(input.baseUrl || current.baseUrl || DEEPSEEK_DEFAULTS.baseUrl).replace(/\/+$/, ''),
      model: input.model || current.model || DEEPSEEK_DEFAULTS.model,
      instructions: input.instructions || current.instructions || DEFAULT_INSTRUCTIONS,
      quickInstructions: input.quickInstructions || current.quickInstructions || DEFAULT_QUICK_INSTRUCTIONS,
      encryptedKey: current.encryptedKey,
    };
    if (next.provider === 'deepseek') {
      if (/api\.openai\.com/i.test(next.baseUrl)) next.baseUrl = DEEPSEEK_DEFAULTS.baseUrl;
      if (!DEEPSEEK_MODELS.has(next.model)) next.model = DEEPSEEK_DEFAULTS.model;
    }
    if (input.apiKey) {
      if (!this.safeStorage.isEncryptionAvailable()) throw new Error('当前系统安全存储不可用，无法安全保存密钥');
      next.encryptedKey = this.safeStorage.encryptString(input.apiKey).toString('base64');
    }
    fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    fs.writeFileSync(this.settingsPath, JSON.stringify(next, null, 2), { mode: 0o600 });
    try { fs.chmodSync(this.settingsPath, 0o600); } catch {}
    return this.getSettings();
  }

  createClient() {
    const raw = this.readRaw();
    const apiKey = this.resolveKey(raw);
    if (!apiKey) throw new Error('请先在设置中配置 API Key');
    return { client: new OpenAI({ apiKey, baseURL: raw.baseUrl || undefined }), raw };
  }

  async testConnection() {
    const result = await this.generate({ question: '只回复“连接成功”', evidence: [], instructions: '只进行连接测试。', maxTokens: 40 });
    return { ok: true, message: result.text || '连接成功' };
  }

  async generate({ question, evidence = [], instructions, history = [], attachments = [], maxTokens = 1400 }) {
    const { client, raw } = this.createClient();
    const evidenceText = evidence.length ? `\n\n资料证据：\n${evidence.map((item, index) => `[${index + 1}] ${item.source} · ${item.locator}\n${item.text}`).join('\n\n')}` : '';
    const attachedNames = attachments.length ? `\n\n本次附件：${attachments.map((item) => item.name).join('、')}` : '';
    const prompt = `${question}${attachedNames}${evidenceText}`;
    const images = attachments.filter((item) => IMAGE_MIME[path.extname(item.path).toLowerCase()]).map((item) => {
      const extension = path.extname(item.path).toLowerCase();
      const stat = fs.statSync(item.path);
      if (stat.size > 20 * 1024 * 1024) throw new Error(`图片 ${item.name} 超过 20MB，暂时无法发送`);
      return { type: 'image_url', image_url: { url: `data:${IMAGE_MIME[extension]};base64,${fs.readFileSync(item.path).toString('base64')}` } };
    });
    if (raw.provider === 'deepseek') {
      const model = images.length ? 'deepseek-v4-flash-vision-exp' : raw.model;
      const response = await client.chat.completions.create({
        model, max_tokens: maxTokens,
        messages: [{ role: 'system', content: instructions || raw.instructions || DEFAULT_INSTRUCTIONS }, ...history.slice(-10), { role: 'user', content: images.length ? [{ type: 'text', text: prompt }, ...images] : prompt }],
      });
      return { text: response.choices[0]?.message?.content || '', provider: raw.provider, model, requestId: response._request_id };
    }
    const input = images.length ? [{ role: 'user', content: [{ type: 'input_text', text: prompt }, ...images.map((item) => ({ type: 'input_image', image_url: item.image_url.url }))] }] : prompt;
    const response = await client.responses.create({ model: raw.model, instructions: instructions || raw.instructions || DEFAULT_INSTRUCTIONS, input, max_output_tokens: maxTokens, store: false });
    return { text: response.output_text || '', provider: raw.provider || 'openai', model: raw.model, requestId: response._request_id };
  }

  async generateMedia({ type, prompt, model }) {
    const { client } = this.createClient();
    const outputDir = path.join(path.dirname(this.settingsPath), 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    if (type === 'image-generation') {
      const response = await client.images.generate({ model: model || 'gpt-image-1', prompt, size: '1024x1024' });
      const item = response.data?.[0];
      if (!item?.b64_json && !item?.url) throw new Error('生图服务未返回图像');
      const buffer = item.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer());
      const outputPath = path.join(outputDir, `AI-生图-${Date.now()}.png`);
      fs.writeFileSync(outputPath, buffer);
      return { status: 'completed', path: outputPath };
    }
    const job = await client.videos.create({ model: model || 'sora-2', prompt, seconds: '4', size: '1280x720' });
    let current = job;
    for (let attempt = 0; attempt < 120 && !['completed', 'failed'].includes(current.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      current = await client.videos.retrieve(job.id);
    }
    if (current.status === 'failed') throw new Error(current.error?.message || '视频生成失败');
    if (current.status !== 'completed') return { status: current.status, jobId: current.id, progress: current.progress };
    const response = await client.videos.downloadContent(current.id);
    const outputPath = path.join(outputDir, `AI-视频-${Date.now()}.mp4`);
    fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
    return { status: 'completed', path: outputPath, jobId: current.id };
  }
}

module.exports = { AIService, DEFAULT_INSTRUCTIONS };
