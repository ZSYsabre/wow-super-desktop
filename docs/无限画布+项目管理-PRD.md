# 产品需求文档（PRD）——「知境：无限知识画布」

> 文档状态：基于现有源码（v0.2.0）逆向拆解得出
> 项目代号：knowledge-canvas（无限画布 + 项目管理）
> 文档版本：v1.0
> 拆解日期：2025-08-28
> 需求来源：`/Users/SabreZSY/Desktop/无限画布+项目管理.zip`

---

## 目录

1. [产品概述](#1-产品概述)
2. [目标用户与使用场景](#2-目标用户与使用场景)
3. [产品定位与核心价值](#3-产品定位与核心价值)
4. [术语定义](#4-术语定义)
5. [产品范围与演进路线](#5-产品范围与演进路线)
6. [系统架构](#6-系统架构)
7. [功能需求详述](#7-功能需求详述)
8. [数据模型](#8-数据模型)
9. [交互与界面规范](#9-交互与界面规范)
10. [非功能需求](#10-非功能需求)
11. [验收标准](#11-验收标准)
12. [风险与待确认事项](#12-风险与待确认事项)
13. [附录：技术实现清单](#13-附录技术实现清单)

---

## 1. 产品概述

### 1.1 一句话定位

**「知境」是一款本地优先（Local-First）的文件、知识库与 AI 无限画布桌面应用**，让用户把散落在本机的文件与文件夹拖进一张无限画布，通过可视化节点与连线组织资料、构建知识库、向 AI 提问，并把分析结论沉淀为可追溯引用的结论节点，实现"资料 → 知识 → 结论 → 任务"的一体化工作流。

### 1.2 产品背景与要解决的问题

| 痛点 | 现状问题 | 本产品解法 |
|---|---|---|
| 资料散落 | 文件散布在多个文件夹、Finder 中，难以形成知识关联 | 拖入无限画布，形成可视化的"资料地图" |
| 检索低效 | 全文搜索只能命中关键词，无法"带着问题找答案" | SQLite FTS5 全文索引 + 语义化中文分词 + AI 综合回答 |
| 引用不可追溯 | AI 回答没有来源依据，结论无法验证 | 检索证据块 + 引用编号 [1][2] + 文件定位（页码/标题） |
| 知识无法沉淀 | 分析结论停留在对话里，无法复用 | 一键保存为"结论节点"，与资料、任务连线 |
| 隐私焦虑 | 云端笔记/知识库把本地文件上传 | 本地优先，索引、画布、AI 密钥全部留在本机 |

### 1.3 产品形态

- **桌面应用**（Electron），macOS 优先（窗口标题栏隐藏、`titleBarStyle: hiddenInset`），兼容 Windows/Linux。
- **主界面**：左侧窄导航栏 + 顶部标题栏 + 全屏无限画布 + 底部全局提问条。
- **本地优先**：画布状态、资料索引全部保存在本机（SQLite + localStorage），AI 密钥使用系统安全存储加密。

---

## 2. 目标用户与使用场景

### 2.1 目标用户画像

| 画像 | 特征 | 核心诉求 |
|---|---|---|
| **研究者/分析师** | 大量 PDF、Word、访谈记录需要交叉阅读 | 多来源联合分析、结论可追溯、快速定位原文 |
| **产品经理/战略顾问** | 竞品资料、用户访谈、调研报告混杂 | 把资料组织成知识库，产出机会/风险结论 |
| **个人知识管理者** | 收藏夹、笔记、文档零散 | 一张画布管理所有资料与想法，随时向资料提问 |
| **小型团队负责人** | 项目资料 + 待办任务需要关联 | 资料结论直接转任务，形成闭环 |

### 2.2 典型使用场景

1. **调研分析**：导入"用户访谈"文件夹 + "竞品资料"文件夹 → 连线到"新产品调研知识库" → 连接"产品机会分析"AI 节点提问 → 生成"核心结论"节点 + "下一步任务"节点。
2. **资料问答**：拖入若干 PDF → 底部输入框"这些资料里关于定价策略的共同观点是什么？" → 得到带 [1][2] 引用的回答 → 点击引用直达原文件。
3. **项目整理**：把画布上的文件拖进"画布文件夹"节点收纳 → 双击进入"文件夹画布"进行二次编排 → 把结论转成任务节点。
4. **快速咨询**：侧边"AI 快问"做通用对话（不读画布资料），与画布资料问答严格隔离。

---

## 3. 产品定位与核心价值

### 3.1 核心闭环

```
导入资料 → 本地解析索引 → 可视化连线组织 → 限定范围检索 → AI 综合回答(带引用) → 沉淀为结论节点 → 转化为任务
```

### 3.2 价值主张

- **可视化**：一切资料、知识库、AI 分析、结论、任务都是画布上的节点，关系一目了然。
- **可追溯**：每条 AI 结论都带来源引用（文件名 + 定位 + 原文块），可点击打开原文件。
- **本地优先**：数据不出本机，隐私安全，无网络也可检索。
- **AI 原生**：AI 不只是聊天，而是嵌入到"节点级"的工作流中（每个 AI 节点可配置独立指令与资料范围）。

---

## 4. 术语定义

| 术语 | 含义 |
|---|---|
| **画布（Canvas）** | 基于 React Flow 的无限可缩放（0.2x–2x）二维空间，承载所有节点与连线 |
| **节点（Node）** | 画布上的一个可视化对象，有 7 种类型（见下） |
| **节点类型（CanvasNodeKind）** | `file`（文件）、`folder`（文件夹/画布文件夹）、`knowledge-base`（知识库）、`ai`（AI 分析）、`answer`（结论）、`task`（任务）、`note`（注释） |
| **资料（Asset）** | 用户导入的本地文件或文件夹，对应磁盘真实对象 |
| **画布节点 vs 资料节点** | 画布上所有对象都是"节点"；其中 `file`/`folder` 节点绑定了真实"资料（Asset）" |
| **连线（Edge）** | 节点间的关系，有 4 种语义类型（见下） |
| **连线类型（CanvasEdgeKind）** | `relation`（属于知识库）、`ai-context`（提供给 AI）、`workflow`（工作流输入/生成）、`visual`（仅视觉连接） |
| **知识库（Knowledge Base）** | 汇聚多个资料来源的容器节点，只显示真实连入的来源 |
| **索引（Index）** | 对文件内容做解析 + 分块 + FTS5 全文建索引的过程 |
| **分块（Chunk）** | 文本按约 900 字符切分的最小检索单元 |
| **引用（Citation）** | 检索命中的证据块，含文件、定位、页码、原文、相关度分数 |
| **定位（Locator）** | 证据在原文中的位置（如"第 3 页"、Markdown 标题） |
| **文件夹画布（Folder Canvas）** | 双击画布文件夹节点后弹出的有限子画布，用于收纳与二次编排 |
| **废纸篓（Trash）** | 系统级删除操作（`shell.trashItem`），区别于"移出画布" |
| **AI 快问** | 右侧通用 AI 对话面板，不读取画布资料 |
| **全局提问条** | 底部输入框，基于整个画布的全部资料检索 + AI 回答 |

---

## 5. 产品范围与演进路线

### 5.1 当前版本（v0.2.0，已实现）

- 全屏深色无限画布（可切白色背景）
- 7 类节点 + 4 类连线的可视化编排
- 系统对话框 / 拖放导入本地文件与文件夹
- 真实资料与画布节点分离（节点是资料的"投影"）
- 本地保存画布位置、节点、连线（localStorage + SQLite 双写）
- SQLite 资料库 + FTS5 全文索引（中文 bigram 分词）
- PDF / Word / Markdown / TXT / HTML 文档解析
- 文件夹递归扫描、进度状态、子节点展开
- 按选中节点 / 连线范围检索，返回文件定位引用
- 检索结果保存为结论节点
- 4 类右键菜单（空白/单节点/多选/连线）
- 打开原文件、Finder 定位、重新扫描、复制到桌面
- "移出画布"与"移到系统废纸篓"分离，带删除影响确认
- 右键新建画布文件夹、知识库、AI、便签、任务节点
- 双击重命名、便签直接编辑、属性面板修改
- 资料拖入知识库自动建立成员关系
- 侧栏展示真实资料/知识库/任务/搜索/处理状态并可定位
- AI API 设置、系统加密密钥存储、模型与兼容地址配置
- OpenAI Responses API / DeepSeek Chat Completions API 双协议
- AI 快问（通用对话，与资料问答隔离）

### 5.2 下一阶段（README 已声明，未实现）

- **嵌入式向量检索**（当前为关键词 + 中文 bigram，无向量语义检索）
- **应用内 PDF/Word 预览与原文高亮定位**（当前仅"打开原文件"）

### 5.3 建议后续路线（拆解者补充，非源码内容）

- 多项目/多工作区切换（当前画布是单工作区）
- 节点协作/导出（Markdown、图片导出）
- 定时任务与提醒
- 移动端只读查看

---

## 6. 系统架构

### 6.1 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 桌面框架 | Electron 43 | `main` / `preload` / `renderer` 三段式 |
| 前端框架 | React 18 + TypeScript 5.7 | 严格模式 `strict: true` |
| 构建工具 | Vite 6 | 开发端口 5173，`dist` 产物 |
| 画布引擎 | @xyflow/react 12.8 | React Flow，无限画布核心 |
| 状态管理 | Zustand 5 | 画布 store + 撤销栈 + 持久化 |
| 图标 | lucide-react | 统一图标库 |
| 数据库 | node:sqlite (DatabaseSync) | SQLite，WAL 模式，FTS5 虚拟表 |
| 文档解析 | mammoth（Word）、pdfjs-dist（PDF） | 另有原生 TXT/HTML/Markdown 解析 |
| AI SDK | openai v6 | 同时支持 Responses API 与 Chat Completions |
| 测试 | Vitest（前端）+ node:test（后端） | |

### 6.2 进程架构

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer（React 渲染进程）                                    │
│  App.tsx / store.ts / components/* / services/knowledge.ts   │
│  - 画布交互、UI、状态、撤销栈、localStorage 持久化            │
└──────────────────────────┬──────────────────────────────────┘
                           │ contextBridge（window.desktop）
┌──────────────────────────▼──────────────────────────────────┐
│  Preload（preload.cjs）                                       │
│  - 暴露 24 个 IPC 方法 + 2 个事件订阅（进度/拖放）            │
│  - contextIsolation: true, sandbox: true, nodeIntegration:false│
└──────────────────────────┬──────────────────────────────────┘
                           │ ipcMain.handle / ipcRenderer.invoke
┌──────────────────────────▼──────────────────────────────────┐
│  Main（main.cjs）                                             │
│  - 窗口管理、系统对话框、文件操作、原生图标/缩略图            │
│  ├─ KnowledgeService（knowledge-service.cjs）                │
│  │   SQLite 资产表/chunks/FTS5/工作区状态、解析、检索         │
│  └─ AIService（ai-service.cjs）                              │
│      设置持久化、safeStorage 密钥加密、OpenAI/DeepSeek 调用  │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 数据存储分层

| 存储 | 位置 | 内容 |
|---|---|---|
| localStorage | 渲染进程 | 画布节点/连线/资产快照（`knowledge-canvas.workspace.v1`）、主题、全局提示词、快问提示词、文件夹主题 |
| SQLite | `userData/knowledge-canvas.sqlite` | 资产表、chunks、FTS5 索引、工作区状态（权威备份） |
| JSON 文件 | `userData/ai-settings.json`（权限 0600） | AI 供应商/baseUrl/model/指令/加密后的 Key |

> 说明：画布状态"双写"——localStorage 作为即时读写源，SQLite `workspace_state` 作为权威持久化（`hydrate` 启动时优先读 SQLite，用于跨进程/防丢失）。

---

## 7. 功能需求详述

### 7.1 无限画布

#### 7.1.1 画布视口

| 需求编号 | 需求描述 |
|---|---|
| CV-01 | 提供全屏无限画布，支持缩放（最小 0.2x，最大 2x） |
| CV-02 | 支持滚轮缩放（`panOnScroll`）、空格 + 拖拽平移（`panActivationKeyCode="Space"`） |
| CV-03 | 两种交互模式切换：**选择/框选** 与 **拖动画布**（左上角工具栏） |
| CV-04 | 框选模式（`SelectionMode.Partial`，局部相交即选中）、框选时自动平移到边缘 |
| CV-05 | 左下角缩放控件（Zoom In/Out/Fit/锁定），右下角可拖动/缩放的迷你地图 |
| CV-06 | 深色 / 白色双主题，切换后即时保存（`knowledge-canvas.main-theme`） |
| CV-07 | 点状网格背景（Dots，间距 22），随主题切换颜色 |

#### 7.1.2 节点通用能力

| 需求编号 | 需求描述 |
|---|---|
| ND-01 | 7 类节点：文件、文件夹、知识库、AI、答案/结论、任务、注释，各有独立图标与配色 |
| ND-02 | 节点选中后可拖动调整尺寸（NodeResizer），各类节点有不同最小/最大尺寸 |
| ND-03 | 双击标题进入重命名（文件/文件夹节点重命名会同步磁盘文件名） |
| ND-04 | 节点带 4 个连接点（左/上/右/下），连线可拖拽重连（`edgesReconnectable`） |
| ND-05 | 连线采用"宽松连接模式"（`ConnectionMode.Loose`），连接半径 42px，重连半径 48px |
| ND-06 | 节点支持拖拽，拖动到"文件夹节点"上自动收纳，拖动到"知识库节点"上自动连线（见 7.4） |
| ND-07 | 节点被搜索结果命中时高亮（黄色边框 + 脉动动画 + "搜索命中"标签，约 3.2s 后消退） |
| ND-08 | 节点可复制粘贴（⌘C / ⌘V）、删除（Delete/Backspace，删除节点时自动删除关联连线） |

#### 7.1.3 各节点类型详细规格

**① 文件节点（file）**
- 显示：原生文件图标（或缩略图）+ 文件名（最多 2 行省略）。
- 状态徽标：`等待处理 / 正在解析 / 已索引 / 处理失败 / 暂不支持`。
- 双击：打开原文件（`shell.openPath`）。
- 右键：打开原文件、Finder 显示、向 AI 提问、复制到桌面、移出画布、移到废纸篓。
- 最小尺寸 140×120，最大 420×420。

**② 文件夹节点（folder）**
- 两种含义：绑定真实磁盘文件夹（显示"X 个文件"）+ 纯画布收纳文件夹（`status: virtual`）。
- 双击：打开"文件夹画布"（见 7.6）。
- 右键额外项：展开文件夹（拉取真实子节点，最多 12 个）、重新扫描并更新索引、向整个文件夹提问。
- 折叠/展开：`collapsed` 控制子节点显隐。

**③ 知识库节点（knowledge-base）**
- 显示：连入来源列表（最多 4 个，超出省略）+ 空态提示"拖入文件、文件夹，或用连线加入资料"。
- 只显示真实连入的来源（`sourceCount` 动态）。
- 右键/多选可"创建知识库"并自动连线。
- 最小尺寸 240×105。

**④ AI 分析节点（ai）**
- 显示：已连接上游节点数 + 直接资料来源数、回答内容（Markdown 渲染）、底部提问输入框、引用按钮。
- 独立系统指令：节点内设置按钮弹出 textarea，即时保存，仅作用于该节点；可"恢复默认"。
- 提问：Enter 发送，Shift+Enter 换行；分析时显示"分析中"。
- 引用：最多展示 3 条，点击打开原文件。
- 最小尺寸 280×190，最大 720×620。

**⑤ 结论节点（answer）**
- 显示：结论标题 + 引用数量副标题 + Markdown 正文。
- 由"保存为结论节点"自动生成，也可右键新建。
- 右键：查看来源引用（弹出引用列表）。
- 最小尺寸 210×100。

**⑥ 任务节点（task）**
- 显示：任务标题 + 状态副标题（`待确认`）。
- 属性面板可编辑内容（body）。
- 侧栏"任务"页展示所有任务节点并可定位。
- 最小尺寸 210×100。

**⑦ 注释节点（note）**
- 双击正文进入编辑（textarea），失焦保存；空态提示"双击添加注释"。
- 属性面板可编辑名称/说明/内容。
- 最小尺寸 220×145。

#### 7.1.4 连线（Edge）

| 需求编号 | 需求描述 |
|---|---|
| ED-01 | 连线 4 种语义：`relation`（属于知识库，默认灰色实线）、`ai-context`（提供给 AI，紫色实线）、`workflow`（生成/工作流，蓝色虚线）、`visual`（仅视觉连接，无标签） |
| ED-02 | 连线带语义标签：`ai-context`→"提供给 AI"，`workflow`→"生成" |
| ED-03 | 右键连线：更改关系类型（4 种）、删除连线 |
| ED-04 | 连线上有"插入 AI 节点"按钮（➕，端点无 AI 节点时显示），点击在连线中点插入 AI 节点并拆分连线为两条 |
| ED-05 | 连线可拖拽重连（端点更新器），选中高亮黄色 |
| ED-06 | 连线语义自动推断：新连线目标为 AI 节点时默认 `ai-context`，否则 `relation` |

#### 7.1.5 右键菜单（Context Menu）

| 目标 | 菜单项 |
|---|---|
| **空白画布** | 导入文件或文件夹… / 新建画布文件夹 / 新建知识库 / 新建注释 / 新建任务 / 一键整理未连接节点 / 整理当前视图 |
| **单节点（有资料）** | 打开原文件 / Finder 显示 / 展开文件夹(仅文件夹) / 向 AI 提问 / 重新扫描(仅文件夹) / 复制到桌面 / 移出当前画布 / 将原文件(夹)移到废纸篓 |
| **单节点（无资料）** | 继续提问(仅 AI) / 查看来源引用(仅结论) / 复制节点 / 删除节点 |
| **多选节点** | 向选中的 N 个节点提问 / 复制所选 N 个节点 / 创建知识库 / 整理所选节点 / 移出当前画布 |
| **连线** | 更改关系类型（4 项）/ 删除连线 |

#### 7.1.6 一键整理

| 需求编号 | 需求描述 |
|---|---|
| LY-01 | "一键整理未连接节点"：将未连线的可见节点按标题中文排序，排到已连接图右侧（每列 7 个，间距 250×125） |
| LY-02 | "整理当前视图"：`fitView` 适配全部节点 |
| LY-03 | "整理所选节点"：选中的节点按 Y 坐标排序，水平排成一行（间距 260） |

#### 7.1.7 撤销 / 重做

- ⌘Z / Ctrl+Z 撤销上一步画布操作。
- 实现：维护 80 步快照栈（`undoStack`），节流 450ms 内只记一次，结构化克隆快照。
- 撤销范围：节点/连线增删改、位置、收纳/移出等（不含资料索引）。
- 无重做（Redo）功能（仅单栈撤销）。

---

### 7.2 资料导入与索引

#### 7.2.1 导入方式

| 需求编号 | 需求描述 |
|---|---|
| IM-01 | 系统文件对话框导入（支持多选：文件 + 目录混合），`openFile + openDirectory + multiSelections` |
| IM-02 | 拖放导入：把文件/文件夹直接拖入画布窗口，自动识别路径（`webUtils.getPathForFile`） |
| IM-03 | 导入后自动进入"资料"侧栏，并执行解析索引 |

#### 7.2.2 支持格式

| 格式 | 扩展名 | 解析方式 |
|---|---|---|
| PDF | `.pdf` | pdfjs-dist 逐页提取文本，定位"第 N 页" |
| Word | `.docx` | mammoth 提取正文，定位"正文" |
| Markdown | `.md` / `.markdown` | 按标题（#~######）分节，定位为标题名 |
| 纯文本 | `.txt` | 全文读取，定位"全文" |
| HTML | `.html` / `.htm` | 去脚本/样式/标签，定位"页面正文" |
| 其他 | — | 标记为 `unsupported`（暂不支持），不建索引 |

#### 7.2.3 索引流程（文件夹）

```
导入文件夹 → 状态 scanning → 递归遍历子项(每层最多1000项，跳过.开头) 
→ 状态 processing(记录文件总数) → 逐个解析支持的文件 → 每完成一个推送 folder-progress 
→ 状态 ready(记录 childCount)
```

- 递归深度遍历，子文件记录 `parent_id`。
- 进度推送两种事件：`asset`（单个资产状态变化）、`folder-progress`（`completed/total`）。

#### 7.2.4 索引状态机

| 状态 | 含义 | 触发 |
|---|---|---|
| `pending` | 等待处理 | 导入初始 |
| `scanning` | 正在扫描（文件夹遍历中） | `processTree` 开始 |
| `processing` | 正在解析/建索引 | 文件解析中 |
| `ready` | 已索引 | 解析完成 |
| `failed` | 处理失败 | 解析异常 |
| `unsupported` | 暂不支持 | 扩展名不在支持集 |

#### 7.2.5 分块策略

- 文本清洗：`/\s+/g` → 空格合并。
- 分块大小：900 字符，步进重叠 120 字符（`start += size - 120`）。
- 每块写入 `chunks` 表 + `chunks_fts` FTS5 表（`tokenize='unicode61'`）。

#### 7.2.6 资料操作

| 操作 | 说明 |
|---|---|
| 打开原文件 | `shell.openPath` |
| Finder 定位 | `shell.showItemInFolder` |
| 复制到桌面 | 复制到 Desktop，重名自动加" 2/ 3"后缀，完成后 Finder 显示 |
| 重命名 | 校验路径合法性，磁盘 `fs.rename` + 索引库同步（含子项相对路径），返回带 `previousPath` 的资产列表 |
| 重新扫描 | 对单个资产（尤其文件夹）重新执行 `processTree`，重建索引 |
| 移到废纸篓 | `shell.trashItem` + 删除索引（含所有子孙 chunk/assets），需二次确认 |

---

### 7.3 检索系统

#### 7.3.1 检索范围（Scope）

- 通过 `resolveScope` 递归展开资产范围：给定资产 ID 集合 + 资产路径集合，展开其所有子孙。
- 画布提问范围由"节点连接的资产"动态计算（`scopedAssetIds` 通过图遍历 BFS 收集，遇到 AI 节点停止继续扩展）。

#### 7.3.2 检索算法（关键词 + 中文 bigram）

1. 问题归一化小写。
2. 提取词项：
   - 英文/数字：`/[a-z0-9][a-z0-9._-]{1,}/g`
   - 中文：连续汉字串，取 2 字 bigram 滑窗 + 4 字（步长 2）组合。
3. 词项最多取 48 个。
4. SQL 取范围内最近 300 个 chunk（`ORDER BY chunks.rowid DESC LIMIT 300`）。
5. 打分：内容命中 +1/词，文件名命中 +4/词（文件名权重高）。
6. 排序取分数 > 0 的前 5 条（`ensureCoverage=false`）。

#### 7.3.3 覆盖模式（ensureCoverage = true）

用于 AI 节点"综合多个来源"：优先每个资产取 1 条（最多 8 个资产），再补齐高分项到 8 条，保证"每个连接文件都有证据"。

#### 7.3.4 检索结果结构（Citation）

```
chunkId / assetId / source(文件名) / sourcePath(绝对路径) / locator(定位) 
/ page(页码) / text(原文块) / score(分数)
```

---

### 7.4 知识库与关系建立

| 需求编号 | 需求描述 |
|---|---|
| KB-01 | 知识库节点只显示真实连入的来源（连线 + 拖拽均计入） |
| KB-02 | 拖资料节点到知识库节点：自动建立 `relation` 连线 |
| KB-03 | 拖文件/文件夹节点到画布文件夹节点：自动收纳（节点 + 连线隐藏，文件夹 `childNodeIds` 记录成员，count 更新） |
| KB-04 | 多选节点右键"创建知识库"：新建知识库节点并自动连线所有选中节点 |
| KB-05 | 知识库/ AI 节点属性面板展示"连接的资料来源"列表 |
| KB-06 | 收纳的节点从主画布隐藏（`hidden: true`），移出时恢复并重新定位 |

---

### 7.5 AI 能力

#### 7.5.1 AI 配置（设置对话框）

| 需求编号 | 需求描述 |
|---|---|
| AI-01 | 供应商选择：OpenAI / DeepSeek / 其他 OpenAI 兼容服务 |
| AI-02 | 模型配置：OpenAI 手填（默认 `gpt-5.4`）；DeepSeek 下拉（`deepseek-v4-flash` / `deepseek-v4-pro`） |
| AI-03 | API 地址可配置，自动去尾部 `/` |
| AI-04 | API Key：系统安全存储加密（`safeStorage.encryptString` → base64 存文件，权限 0600）；留空不修改；显示脱敏提示（前 3 位 + •••• + 后 4 位） |
| AI-05 | 环境变量密钥优先：`OPENAI_API_KEY`、DeepSeek 用 `DEEPSEEK_API_KEY` |
| AI-06 | 默认 AI 指令可配置（默认："仅根据提供的资料证据回答…[1][2] 标记来源"） |
| AI-07 | "测试连接"按钮：调用模型，返回"连接成功"/错误信息 |

#### 7.5.2 全局资料问答（底部提问条）

| 需求编号 | 需求描述 |
|---|---|
| QA-01 | 底部常驻输入框，范围="整个画布全部资料"（显示"全局 · N 份资料"） |
| QA-02 | 流程：检查未索引资料 → 确保索引 → 检索 → AI 回答（未配置 Key 时降级为"展示检索到的关键证据"） |
| QA-03 | 回答弹层：Markdown 渲染 + 复制按钮 + 引用按钮列表（点击打开原文件） |
| QA-04 | "保存为结论节点"：将回答 + 引用保存为 `answer` 节点，并从选中节点连线 |
| QA-05 | 全局提示词可配置（设置图标弹层，自动保存，可恢复默认） |
| QA-06 | Enter 发送（中文输入法组合态不触发） |

#### 7.5.3 AI 节点问答（节点级）

- 范围 = 该 AI 节点连接的所有上游非 AI 节点关联的资产（BFS 收集）。
- 独立指令优先级 > 全局默认。
- 结果写入节点 body，引用写入 citations，状态更新 `ready` / `failed`。

#### 7.5.4 AI 快问（侧边通用对话）

| 需求编号 | 需求描述 |
|---|---|
| CH-01 | 右侧滑出对话面板，多轮上下文（保留最近 10 条） |
| CH-02 | **不读取画布文件**（明确提示 + 独立提示词），与资料问答隔离 |
| CH-03 | 欢迎页快捷提问（梳理产品想法/生成工作计划/解释概念） |
| CH-04 | 支持清空对话、配置 API 跳转、Markdown 渲染 + 复制 |
| CH-05 | Enter 发送，Shift+Enter 换行；分析中显示 spinner |

#### 7.5.5 协议适配

| 供应商 | 协议 | 参数 |
|---|---|---|
| OpenAI | Responses API（`client.responses.create`） | `input`、`instructions`、`max_output_tokens:1400`、`store:false` |
| DeepSeek | Chat Completions（`client.chat.completions.create`） | `messages`、`system`、`max_tokens:1400` |
| 兼容服务 | 走 Responses API（baseURL 可自定义） | 同上 |

---

### 7.6 文件夹画布（Folder Canvas）

双击画布文件夹节点后弹出的**有限子画布**（960×680 模态层）。

| 需求编号 | 需求描述 |
|---|---|
| FC-01 | 展示：文件夹收纳的逻辑节点（`childNodeIds`）+ 磁盘直属子资产（`parentId === folder.assetId`，排除已隐藏） |
| FC-02 | 支持框选、连线、拖拽、缩放（0.65x–1.35x）、布局保存（`folderLayout` 按节点 ID 记忆坐标） |
| FC-03 | 顶部操作栏：一键整理全部 / 重命名 / 批量重命名（统一前缀 + 序号）/ 复制 / 移出到主画布 / 从画布删除 |
| FC-04 | 拖出边界（或底部拖出区）：把选中项移回主画布 |
| FC-05 | 从画布删除 ≠ 删除磁盘文件（底部有明确提示） |
| FC-06 | 双击：逻辑节点标题重命名，磁盘资产节点打开原文件 |
| FC-07 | 快捷键：Delete 删除、⌘D 复制、⌘C/⌘V 复制粘贴、⌘Z 撤销 |
| FC-08 | "系统中打开"按钮打开文件夹原目录 |
| FC-09 | 主题独立于主画布（`knowledge-canvas.folder-theme`） |

---

### 7.7 侧栏（Sidebar / Drawer）

左侧导航 7 个入口：画布 / 资料 / 知识 / 任务 / 搜索 /（底部）状态 / 设置。

| 栏目 | 内容 |
|---|---|
| **画布** | 关闭侧栏，展示主画布 |
| **资料** | 资料列表（最多 80 条），筛选：全部/最近(20)/处理中/失败；搜索框；"添加文件或文件夹"按钮；点击项打开原文件 |
| **知识** | 当前画布所有知识库节点列表，"新建知识库"按钮；点击定位节点 |
| **任务** | 所有任务节点列表；点击定位节点 |
| **搜索** | 搜索框 + 画布节点匹配（标题/资料名，最多 30）；命中节点高亮并定位 |
| **状态** | 处理概览：已完成索引数 / 正在处理数 / 处理失败数 / AI 结果节点数 |
| **设置** | 打开 AI 与 API 设置对话框 |

**定位节点（locateNode）**：选中 + 高亮 + `setCenter` 居中（zoom=1，300ms 动画），3.2s 后取消高亮。

---

### 7.8 节点属性面板（Node Inspector）

选中单节点时右上角显示（290px 宽）：

| 字段 | 适用节点 |
|---|---|
| 名称（title） | 全部 |
| 说明（subtitle） | 全部 |
| 注释内容/内容（body） | note、task |
| 该节点的 AI 指令（instructions） | ai |
| 连接的资料来源列表 | knowledge-base、ai |
| 原始资料路径 + 打开原文件按钮 | 有 assetId 的节点 |

---

### 7.9 持久化与恢复

| 需求编号 | 需求描述 |
|---|---|
| PS-01 | 所有节点/连线/资产变化即时持久化（localStorage 同步 + SQLite 异步写） |
| PS-02 | 启动 `hydrate`：优先从 SQLite 加载工作区（权威），覆盖本地 |
| PS-03 | 连线 handle 归一化：`target-` 前缀替换为 `source-`（历史数据兼容） |
| PS-04 | 撤销栈上限 80 步，450ms 节流 |
| PS-05 | "清空工作区"恢复初始示例画布 |

#### 初始示例画布（首次启动）

6 节点 + 5 连线演示"调研工作流"：
- 用户访谈（文件夹）→ 新产品调研知识库 ← 竞品资料（文件夹）
- 知识库 → 产品机会分析（AI）→ 核心结论（answer）+ 下一步任务（task）

---

## 8. 数据模型

### 8.1 前端类型（TypeScript）

```ts
type AssetKind = 'file' | 'folder';
type CanvasNodeKind = 'file' | 'folder' | 'knowledge-base' | 'ai' | 'answer' | 'task' | 'note';
type CanvasEdgeKind = 'visual' | 'relation' | 'ai-context' | 'workflow' | 'ai-suggested';

interface Asset {
  id: string; path: string; name: string; kind: AssetKind;
  size: number; modifiedAt: number; extension: string;
  parentId?: string; childCount?: number; error?: string; previousPath?: string;
  indexStatus: 'pending' | 'scanning' | 'processing' | 'ready' | 'failed' | 'unsupported';
}

interface KnowledgeNodeData {
  kind: CanvasNodeKind; title: string; subtitle: string;
  assetId?: string; collapsed?: boolean; count?: number; sourceCount?: number;
  status?: string; progress?: number; body?: string; instructions?: string;
  citations?: Citation[]; childNodeIds?: string[];
  folderEdges?: Array<{ id: string; source: string; target: string }>;
  folderHiddenAssetIds?: string[];
  folderLayout?: Record<string, { x: number; y: number }>;
}

interface Citation {
  chunkId: string; assetId: string; source: string; sourcePath: string;
  locator: string; page?: number; text: string; score: number;
}

interface AISettings {
  provider: string; baseUrl: string; model: string; instructions: string;
  configured: boolean; keyHint: string;
  encryptionAvailable: boolean; usingEnvironmentKey: boolean;
}
```

### 8.2 SQLite 表结构

```sql
-- 资产表
CREATE TABLE assets (
  id TEXT PRIMARY KEY, parent_id TEXT, path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, kind TEXT NOT NULL, extension TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0, modified_at REAL NOT NULL DEFAULT 0,
  index_status TEXT NOT NULL DEFAULT 'pending',
  child_count INTEGER NOT NULL DEFAULT 0, error TEXT
);

-- 内容分块表
CREATE TABLE chunks (
  id TEXT PRIMARY KEY, asset_id TEXT NOT NULL,
  content TEXT NOT NULL, locator TEXT NOT NULL, page INTEGER, heading TEXT,
  FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- 全文索引（FTS5 虚拟表）
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  chunk_id UNINDEXED, asset_id UNINDEXED, content,
  tokenize='unicode61'
);

-- 工作区状态（单行，id=1）
CREATE TABLE workspace_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL, updated_at REAL NOT NULL
);
```

数据库使用 `PRAGMA journal_mode = WAL`。

### 8.3 AI 设置文件（ai-settings.json，权限 0600）

```json
{
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-5.4",
  "encryptedKey": "base64(...)",
  "instructions": "仅根据提供的资料证据回答……"
}
```

---

## 9. 交互与界面规范

### 9.1 布局

```
┌─────┬──────────────────────────────────────────┬────────────┐
│ 侧边│  顶栏（项目标题 / 搜索 / AI快问）          │            │
│ 导航├──────────────────────────────────────────┤   AI快问   │
│ 栏  │                                          │   (可选)   │
│ 64px│          无限画布（全屏）                  │  360px    │
│     │    [工具栏]           [迷你地图]           │            │
│     │              [节点+连线]                   │            │
│     │     ┌──────────────────────────┐          │            │
│     │     │  底部全局提问条 (520px)   │          │            │
│     └─────┴──────────────────────────┴──────────┴────────────┘
```

- 顶栏 54px，侧栏 64px；macOS 顶栏可拖拽（`-webkit-app-region: drag`）。
- 窗口默认 1440×900，最小 960×640，背景 `#090b0f`。

### 9.2 视觉规范

| 元素 | 值 |
|---|---|
| 主背景 | `#090b0f`（深色）/ `#f3f5f8`（浅色） |
| 品牌色/主紫 | `#8178ff` |
| 选中边框 | `#8178ff` + 2px 光晕 |
| 搜索命中 | `#ffd34e`（黄） |
| 节点底色 | `#181c24`（深色）/ `#d8dce2`（浅色） |
| 连线默认 | `#4e5869` |
| 危险色 | `#ff8989`（删除）/ `#9f3e4d`（废纸篓按钮） |
| 圆角 | 节点 12px、按钮 6–8px、对话框 13–14px |

### 9.3 反馈规范

- **Toast**：顶部居中，2.2s 自动消失（操作结果反馈）。
- **进度条**：节点内底部紫色进度条（索引进度 < 100% 时显示）。
- **确认对话框**：危险操作（移到废纸篓）二次确认，明确说明影响范围。
- **空态**：资料为空 → 画布底部"把文件或文件夹直接拖入画布"提示；知识库空 → "拖入文件…"；文件夹画布空 → 引导文案。

### 9.4 键盘快捷键

| 快捷键 | 作用 | 作用域 |
|---|---|---|
| Delete / Backspace | 删除选中节点/连线 | 主画布 + 文件夹画布 |
| ⌘C / Ctrl+C | 复制选中节点 | 主画布 + 文件夹画布 |
| ⌘V / Ctrl+V | 粘贴复制节点 | 主画布 + 文件夹画布 |
| ⌘Z / Ctrl+Z | 撤销 | 主画布 + 文件夹画布 |
| ⌘D / Ctrl+D | 复制所选（文件夹画布） | 文件夹画布 |
| Space + 拖拽 | 平移画布 | 主画布 + 文件夹画布 |
| Enter | 发送提问 | 底部输入框 / AI 节点 / 快问 |
| Shift+Enter | 换行 | AI 节点 / 快问 |
| Esc | 关闭菜单/对话框/退出编辑 | 全局 |

> 输入焦点保护：当焦点在 `input / textarea / contenteditable` 或中文输入组合态时，快捷键不触发。

---

## 10. 非功能需求

| 类别 | 需求 |
|---|---|
| **性能** | 画布节点操作流畅（React Flow 虚拟化）；检索 300 chunk 内 ≤ 300ms；文件夹扫描不阻塞主线程（Electron 主进程异步） |
| **安全** | 渲染进程 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`；API Key 用系统 safeStorage 加密；设置文件 0600 权限；路径校验防目录穿越 |
| **隐私** | 本地优先，文件内容不上传；AI 仅发送检索证据块（最多 8 条）与问题，不发送完整文件 |
| **兼容** | Electron 43 在部分 macOS 上 `getFileIcon` 会崩溃，已降级为中性图标回退（源码注释明确） |
| **健壮性** | 资产路径校验失败抛错；重命名冲突提示；复制到桌面重名自动加后缀；删除影响确认 |
| **可维护性** | 类型严格（strict）、前后端分离（IPC 边界清晰）、测试覆盖检索核心逻辑 |
| **可扩展** | `askKnowledgeScope` 明确作为"未来本地索引服务"的边界接口，解析器/混合检索可插件化接入 |

### 安全边界（红线）

1. **"移出画布" ≠ 删除文件**：只有"移到系统废纸篓"才真正删除磁盘文件，且必须二次确认。
2. **AI 快问不读画布**：通用对话与资料问答严格隔离，防止误导。
3. **密钥不落前端**：Key 只在主进程 safeStorage 加密存储，渲染进程只能看到脱敏 hint。

---

## 11. 验收标准

### 11.1 画布

- [ ] 可导入文件+文件夹（对话框与拖放），节点出现在画布并显示索引状态。
- [ ] 节点可拖拽、缩放、重命名、复制、删除、撤销；连线可建立、改语义、重连、删除、插入 AI 节点。
- [ ] 深/浅主题切换即时生效并持久化。
- [ ] 刷新/重启后画布位置、节点、连线完整恢复。

### 11.2 索引与检索

- [ ] PDF/Word/MD/TXT/HTML 均能解析并标记 `ready`；不支持格式标记 `unsupported`。
- [ ] 文件夹递归扫描显示进度，子节点可展开（≤12 个）。
- [ ] 中文问题能命中中文内容（bigram 分词），文件名权重更高。
- [ ] 覆盖模式下每个连接文件都有证据返回。

### 11.3 AI

- [ ] 配置 API 后可测试连接；Key 脱敏显示、留空不覆盖。
- [ ] 底部提问返回带 [n] 引用的回答，引用可点击打开原文件。
- [ ] 未配置 Key 时降级展示检索证据，不报错。
- [ ] AI 节点限定连接范围提问，结果写入节点并带引用。
- [ ] AI 快问不读取画布文件，多轮对话正常。

### 11.4 知识库与文件夹

- [ ] 拖节点到知识库自动连线；知识库只显示真实来源。
- [ ] 拖节点到文件夹自动收纳并从主画布隐藏；双击打开文件夹画布。
- [ ] 文件夹画布支持框选、连线、批量重命名、复制、移出、删除，布局保存。

### 11.5 文件操作安全

- [ ] "移出画布"不删文件；"移到废纸篓"二次确认后才删除。
- [ ] 重命名同步磁盘与索引；复制到桌面重名加后缀；Finder 定位正确。

---

## 12. 风险与待确认事项

| 风险/待确认 | 说明 | 建议 |
|---|---|---|
| 检索为关键词/bigram，无语义 | README 已声明下一阶段做嵌入式向量检索 | 优先接入本地 embedding（如 onnx/bge-small） |
| 无应用内 PDF/Word 预览 | 当前仅"打开原文件"跳外部应用 | 下一阶段内嵌预览 + 原文高亮定位 |
| 单工作区 | 无多项目切换，顶栏"项目标题"为静态示例 | 补充多工作区/多项目数据模型 |
| 单栈撤销（无 Redo） | 误撤销无法恢复 | 增加 redo 栈 |
| 大文件夹性能 | 每层最多遍历 1000 项，分块全量重建 | 增量索引 + 分页 |
| `node:sqlite` 实验性 | Electron 43 内置，依赖较新 | 关注 Electron 升级兼容 |
| 检索取最近 300 chunk | 大资料库可能漏检旧内容 | 改用 FTS 全量检索 + BM25 排序 |
| 无用户登录/多端同步 | 纯本地单机 | 明确为本地优先产品，暂不做云端 |

---

## 13. 附录：技术实现清单

### 13.1 关键文件

```
src/
  App.tsx                    主画布编排、右键/拖放/快捷键/问答流程
  store.ts                   Zustand store、撤销栈、持久化、图操作
  types.ts                   全部 TypeScript 类型
  styles.css                 全部样式（深/浅主题、节点、菜单、对话框）
  components/
    KnowledgeNode.tsx        7 类节点渲染 + 节点级 AI 提问
    KnowledgeEdge.tsx        连线渲染 + 语义标签 + 插入 AI 按钮
    FolderCanvas.tsx         文件夹子画布（内嵌 ReactFlowProvider）
    Sidebar.tsx / AssetDrawer.tsx  导航 + 侧栏
    ContextMenu.tsx          四类右键菜单
    NodeInspector.tsx        节点属性面板
    SettingsDialog.tsx       AI 设置
    AIChatPanel.tsx          AI 快问
    MarkdownContent.tsx      轻量 Markdown 渲染 + 复制
    NativeFileIcon.tsx       原生文件图标/缩略图/文件夹图标
    ConfirmDialog.tsx        确认对话框
  services/
    knowledge.ts             askKnowledgeScope 检索+回答编排（可测试边界）
    knowledge.test.ts        Vitest 单测
electron/
  main.cjs                   窗口 + 24 个 IPC handler
  preload.cjs                contextBridge 暴露 window.desktop
  knowledge-service.cjs      SQLite + 解析 + 检索
  ai-service.cjs             AI 设置 + OpenAI/DeepSeek 调用
  knowledge-service.node-test.cjs  node:test 集成测试
```

### 13.2 IPC 接口清单（window.desktop，共 24 个 + 2 事件）

```
pickAssets / describePaths / ingestPaths / listAssets / listChildren
rescanAsset / getAssetPreview / copyToDesktop / trashAsset / renameAsset
ensureKnowledgeIndexed / searchKnowledge / loadWorkspace / saveWorkspace
getAISettings / saveAISettings / testAIConnection / generateAIAnswer
openAsset / revealAsset
onAssetProgress(订阅) / listenForDrops(订阅)
```

### 13.3 运行命令

```bash
npm install
npm run dev      # 并发启动 Vite + Electron
npm run build    # tsc -b && vite build
npm test         # vitest + node --test
```

---

> 本文档基于 `无限画布+项目管理.zip`（项目 `knowledge-canvas` v0.2.0）源码逐文件拆解，所有功能点均对应源码实现，可直接作为后续开发、迭代与验收的依据。
