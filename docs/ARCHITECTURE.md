# 项目架构

## 桌面应用

`apps/desktop` 是当前主应用，采用 Electron + React + TypeScript + Vite。

- `electron/main.cjs`：窗口、文件系统、工作区与 IPC 主进程。
- `electron/preload.cjs`：向渲染层暴露受控桌面 API。
- `electron/knowledge-service.cjs`：文件解析、索引、检索与引用。
- `electron/ai-service.cjs`：AI 服务配置、请求与本地降级逻辑。
- `src/App.tsx`：画布界面与主要交互编排。
- `src/store.ts`：Zustand 工作区状态、操作命令与持久化。
- `src/components/KnowledgeNode.tsx`：画布节点渲染与节点内操作。
- `src/components/KnowledgeEdge.tsx`：连线与连线中心 AI 动作。

## 交互原型

`apps/prototype` 保留产品早期的界面和交互实验，用于对照设计意图，不作为桌面应用的运行时依赖。

## 本地优先边界

1. 原始文件、解析文本、索引和工作区状态默认保留在本机。
2. 只有用户主动执行 AI 操作时，相关上下文才会发送到已配置的 AI 服务。
3. API Key 通过 Electron `safeStorage` 保护，不写入 Git 仓库。
4. 未配置 AI 服务时，系统可使用本地检索证据生成降级结果。

