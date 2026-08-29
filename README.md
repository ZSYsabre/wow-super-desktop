# 哇塞·超级桌面

一个本地优先的 AI 无限画布桌面应用，用于组织文件、知识库、关系连线和 AI 分析结果。

## 项目结构

```text
.
├── apps/
│   ├── desktop/          # Electron + React 正式桌面应用
│   └── prototype/        # 前端交互原型与早期界面实验
├── docs/                    # PRD、技术手册、架构与交付文档
└── assets/reference/        # 产品视觉参考图
```

## 主要能力

- React Flow 无限画布，支持节点、连线、框选、缩放和迷你地图。
- 文件、图片、视频、文件夹、知识库、AI 分析等多种节点。
- PDF、DOCX、Markdown、TXT 和 HTML 文本解析。
- SQLite WAL、FTS5 和中文 bigram 检索。
- OpenAI、DeepSeek 以及 OpenAI 兼容接口。
- 本地工作区保存、启动恢复和系统安全存储。

## 运行桌面应用

```bash
cd apps/desktop
npm install
npm run dev
```

质量检查：

```bash
npm run typecheck
npm test
npm run build
```

## 运行交互原型

```bash
cd apps/prototype
npm install
npm run dev
```

## 数据与密钥

仓库不包含 `node_modules`、构建产物、Vite/Wrangler 缓存、SQLite 本地数据库、`.env` 文件或 AI API Key。桌面应用的本地工作区与加密设置保存在 Electron `userData` 目录，不随源码上传。

## 文档

- [项目架构](docs/ARCHITECTURE.md)
- [交付检查清单](docs/RELEASE_CHECKLIST.md)
- [无限画布 + 项目管理 PRD](docs/无限画布+项目管理-PRD.md)
- [AI 本地优先技术栈手册](docs/哇塞-超级桌面-AI本地优先桌面产品Vibe-Coding通用技术栈手册.md)

