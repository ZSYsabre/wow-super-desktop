# 哇塞-超级桌面

本地优先的文件、知识库与 AI 无限画布桌面应用。

## 已接入的真实能力

- Electron Main / Preload / Renderer 安全分层；
- 本地文件和文件夹选择、系统拖放导入；
- PDF、DOCX、Markdown、TXT、HTML 文本解析；
- SQLite WAL、FTS5、中文 bigram 检索和引用定位；
- 文件夹递归扫描与索引状态；
- 文件打开、系统定位、重命名、复制到桌面、移到废纸篓；
- React Flow 无限画布、7 类节点、4 类关系、框选、缩放、迷你地图；
- 工作区自动保存、启动恢复、复制粘贴和撤销；
- 全局资料问答、AI 节点限定范围问答、独立 AI 快问；
- OpenAI、DeepSeek、OpenAI 兼容服务配置；
- safeStorage 密钥加密与未配置 AI 时的本地证据降级；
- 结论节点、任务节点、注释、知识库和文件夹子画布。

## 本地运行

```bash
npm install
npm run dev
```

生产构建与检查：

```bash
npm run typecheck
npm test
npm run build
```

首次在新设备安装依赖时，Electron 运行文件会从网络下载。若默认下载源不可用，可使用：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

应用数据默认保存在 Electron 的 `userData` 目录，包括 SQLite 工作区与经系统安全存储加密的 AI 设置。
