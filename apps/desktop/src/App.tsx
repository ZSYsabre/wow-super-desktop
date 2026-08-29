import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, ReactFlow, ReactFlowProvider, SelectionMode,
  useReactFlow, useViewport, type NodeMouseHandler,
} from '@xyflow/react';
import {
  AlertCircle, Bold, Bot, Check, ChevronDown, ClipboardPaste, Copy, Database, ExternalLink,
  FilePlus2, FileSearch, FileText, Folder, FolderPlus, LayoutDashboard, LayoutGrid, MessageSquareText,
  Hand, Image, Italic, Library, List, Moon, MousePointer2, Paperclip, Pencil, Play, Save, Search, Send, Settings, ShieldCheck, Sparkles, Sun,
  Trash2, Upload, X, Zap, Plus,
} from 'lucide-react';
import { KnowledgeNode } from './components/KnowledgeNode';
import { KnowledgeEdge } from './components/KnowledgeEdge';
import { collectEdgeNetwork, collectScope, useCanvasStore } from './store';
import type { AIAttachment, AISettings, Asset, CanvasEdge, CanvasNode, CanvasNodeData, CanvasPage, Citation, EdgeAIAction } from './types';

const nodeTypes = { knowledgeNode: KnowledgeNode };
const edgeTypes = { knowledgeEdge: KnowledgeEdge };
const defaultSettings: AISettings = { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', instructions: '仅根据提供的资料证据回答，重要判断必须标注引用。', quickInstructions: '你是一位专业、清晰、有洞察力的通用思考助手。', configured: false, keyHint: '', encryptionAvailable: true, usingEnvironmentKey: false };
const knowledgeTemplates = [
  { id: 'product', title: '新产品调研', description: '用户需求、市场与机会判断', instructions: '围绕用户痛点、市场空间、解决方案与产品机会组织资料。' },
  { id: 'competitor', title: '竞品分析', description: '功能、定位与差异化对比', instructions: '对竞品定位、核心功能、商业模式、优劣势和差异化机会进行结构化比较。' },
  { id: 'user', title: '用户研究', description: '访谈、反馈与需求洞察', instructions: '提炼用户画像、场景、痛点、行为与未满足需求，并保留原始证据。' },
  { id: 'market', title: '市场洞察', description: '趋势、规模与行业信息', instructions: '归纳行业趋势、市场规模、关键玩家、驱动因素与风险。' },
  { id: 'review', title: '项目复盘', description: '目标、过程与经验沉淀', instructions: '按目标、结果、关键决策、问题、经验和后续行动组织资料。' },
  { id: 'content', title: '内容研究', description: '选题、素材与内容框架', instructions: '整理主题事实、核心观点、案例、引用素材和可用内容结构。' },
];

export default function App() {
  const store = useCanvasStore();
  const flow = useReactFlow();
  const [drawer, setDrawer] = useState<'assets' | 'knowledge' | 'search' | 'status' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [globalPromptOpen, setGlobalPromptOpen] = useState(false);
  const [globalPrompt, setGlobalPrompt] = useState(defaultSettings.instructions);
  const [folderAssetId, setFolderAssetId] = useState<string | undefined>();
  const [folderNodeId, setFolderNodeId] = useState<string | undefined>();
  const [documentNodeId, setDocumentNodeId] = useState<string | undefined>();
  const [videoAssetId, setVideoAssetId] = useState<string | undefined>();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; citations: Citation[]; loading?: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('wow-theme') as 'dark' | 'light') || 'dark');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: 'canvas' | 'selection' | 'edge'; edgeId?: string } | null>(null);
  const [canvasPages, setCanvasPages] = useState<CanvasPage[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState('main');
  const [canvasNameDialog, setCanvasNameDialog] = useState<{ mode: 'create' | 'rename'; id?: string; title: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<{ nodes: CanvasNode[]; edges: CanvasEdge[]; pasteCount: number } | null>(null);
  const dragOriginRef = useRef<Record<string, { x: number; y: number }>>({});
  const dragViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const quickDropHandledRef = useRef(false);
  const locationTimerRef = useRef<number | undefined>();

  const notify = useCallback((message: string) => {
    setToast(message); window.setTimeout(() => setToast(''), 2200);
  }, []);

  const copySelection = useCallback(() => {
    const state = useCanvasStore.getState();
    const nodes = state.nodes.filter((node) => node.selected || node.id === state.selectedId);
    if (!nodes.length) { notify('请先框选需要复制的项目'); return false; }
    const ids = new Set(nodes.map((node) => node.id));
    clipboardRef.current = { nodes: structuredClone(nodes), edges: structuredClone(state.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))), pasteCount: 0 };
    notify(`已复制 ${nodes.length} 个画布项目`);
    return true;
  }, [notify]);

  const pasteSelection = useCallback((screenPosition?: { x: number; y: number }, destinationFolderId?: string) => {
    const clipboard = clipboardRef.current;
    if (!clipboard?.nodes.length) { notify('画布剪贴板中没有可粘贴的项目'); return false; }
    clipboard.pasteCount += 1;
    const idMap = new Map<string, string>(clipboard.nodes.map((node) => [node.id, crypto.randomUUID()]));
    const minX = Math.min(...clipboard.nodes.map((node) => node.position.x));
    const minY = Math.min(...clipboard.nodes.map((node) => node.position.y));
    const anchor = destinationFolderId ? { x: 70, y: 150 } : flow.screenToFlowPosition(screenPosition || { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const nudge = (clipboard.pasteCount - 1) * 24;
    const nodes = clipboard.nodes.map((node) => {
      const clone = structuredClone(node);
      const childNodeIds = clone.data.childNodeIds?.flatMap((id) => { const mapped = idMap.get(id); return mapped ? [mapped] : []; });
      return { ...clone, id: idMap.get(node.id)!, position: { x: anchor.x + node.position.x - minX + nudge, y: anchor.y + node.position.y - minY + nudge }, data: { ...clone.data, childNodeIds }, hidden: false, selected: true };
    });
    const edges = clipboard.edges.map((edge) => ({ ...structuredClone(edge), id: crypto.randomUUID(), source: idMap.get(edge.source)!, target: idMap.get(edge.target)!, selected: false }));
    const state = useCanvasStore.getState();
    state.insertNodes(nodes, edges);
    if (destinationFolderId) state.attachNodesToFolder(destinationFolderId, nodes.map((node) => node.id));
    notify(destinationFolderId ? `已复制 ${nodes.length} 个项目到当前文件夹` : `已粘贴 ${nodes.length} 个画布项目`);
    return true;
  }, [flow, notify]);

  const deleteSelection = useCallback(() => {
    const state = useCanvasStore.getState();
    const selectedNodes = state.nodes.filter((node) => node.selected);
    const nodeIds = selectedNodes.length ? selectedNodes.map((node) => node.id) : state.selectedId ? [state.selectedId] : [];
    const edgeIds = state.edges.filter((edge) => edge.selected).map((edge) => edge.id);
    if (!nodeIds.length && !edgeIds.length) return false;
    state.removeItems(nodeIds, edgeIds);
    if (nodeIds.length) notify(`已删除框选的 ${nodeIds.length} 个画布项目${edgeIds.length ? `和 ${edgeIds.length} 条连接线` : ''}`);
    else notify(`已删除 ${edgeIds.length} 条连接线，相关文件不受影响`);
    return true;
  }, [notify]);

  const importPaths = useCallback(async (paths?: string[], screenPosition?: { x: number; y: number }) => {
    try {
      const selected = paths || await window.desktop.pickAssets();
      if (!selected.length) return;
      const result = await window.desktop.ingestPaths(selected);
      const flowPosition = flow.screenToFlowPosition(screenPosition || { x: 260, y: 220 });
      store.setAssets(result.assets); store.addAssetNodes(result.roots, flowPosition);
      const state = useCanvasStore.getState();
      const container = screenPosition ? state.nodes.find((node) => ['knowledge-base', 'folder'].includes(node.data.kind) && !node.hidden && flowPosition.x >= node.position.x && flowPosition.x <= node.position.x + nodeSize(node, 'width') && flowPosition.y >= node.position.y && flowPosition.y <= node.position.y + nodeSize(node, 'height')) : undefined;
      if (container) {
        const rootIds = new Set(result.roots.map((asset) => asset.id));
        const nodeIds = state.nodes.filter((node) => node.data.assetId && rootIds.has(node.data.assetId)).map((node) => node.id);
        if (container.data.kind === 'knowledge-base') state.attachNodesToKnowledge(container.id, nodeIds);
        else state.attachNodesToFolder(container.id, nodeIds);
        notify(`已将 ${nodeIds.length} 项资料导入“${container.data.title}”`);
      } else notify(`已导入 ${result.roots.length} 项资料，正在建立本地索引`);
    } catch (error) { notify(error instanceof Error ? error.message : '导入失败'); }
  }, [flow, notify, store]);

  useEffect(() => {
    let active = true;
    Promise.all([window.desktop.loadWorkspace(), window.desktop.listAssets()]).then(([workspace, assets]) => {
      if (!active) return;
      const pages = workspace?.canvases?.length ? workspace.canvases : [{ id: 'main', title: '哇塞-超级桌面', nodes: workspace?.nodes || [], edges: workspace?.edges || [] }];
      const activeId = pages.some((page) => page.id === workspace?.activeCanvasId) ? workspace!.activeCanvasId! : pages[0].id;
      const page = pages.find((item) => item.id === activeId) || pages[0];
      setCanvasPages(pages); setActiveCanvasId(activeId);
      store.hydrate(workspace ? { ...workspace, nodes: page.nodes, edges: page.edges } : null, assets);
    }).catch(() => { setCanvasPages([{ id: 'main', title: '哇塞-超级桌面', nodes: [], edges: [] }]); store.hydrate(null, []); });
    const offProgress = window.desktop.onAssetProgress((event) => { if (event.asset) store.updateAsset(event.asset); });
    const offDrops = window.desktop.listenForDrops((paths, position) => void importPaths(paths, position));
    const openFolder = (event: Event) => { const detail = (event as CustomEvent<{ assetId?: string; nodeId: string }>).detail; setFolderAssetId(detail.assetId); setFolderNodeId(detail.nodeId); };
    const openDocument = (event: Event) => setDocumentNodeId((event as CustomEvent<{ nodeId: string }>).detail.nodeId);
    const openVideo = (event: Event) => setVideoAssetId((event as CustomEvent<{ assetId: string }>).detail.assetId);
    window.addEventListener('open-folder-canvas', openFolder);
    window.addEventListener('open-canvas-document', openDocument);
    window.addEventListener('open-canvas-video', openVideo);
    return () => { active = false; offProgress(); offDrops(); window.removeEventListener('open-folder-canvas', openFolder); window.removeEventListener('open-canvas-document', openDocument); window.removeEventListener('open-canvas-video', openVideo); };
  }, []); // lifecycle wiring is intentionally installed once

  useEffect(() => { void window.desktop.getAISettings().then((settings) => setGlobalPrompt(settings.instructions)); }, []);

  useEffect(() => {
    const runEdgeAction = async (event: Event) => {
      const { edgeId, action, instructions, model } = (event as CustomEvent<{ edgeId: string; action: EdgeAIAction; instructions: string; model?: string }>).detail;
      const state = useCanvasStore.getState();
      const edge = state.edges.find((item) => item.id === edgeId);
      if (!edge) return;
      const networkIds = collectEdgeNetwork(edgeId, state.nodes, state.edges);
      const networkNodes = networkIds.map((id) => state.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node));
      const assetIds = [...new Set(networkNodes.map((node) => node.data.assetId).filter(Boolean) as string[])];
      const networkAssets = networkNodes.map((node) => state.assets.find((asset) => asset.id === node.data.assetId)).filter((asset): asset is Asset => Boolean(asset));
      const attachments: AIAttachment[] = networkAssets.filter((asset) => /^\.(png|jpe?g|webp|gif|bmp)$/i.test(asset.extension)).map((asset) => ({ name: asset.name, path: asset.path, kind: asset.kind, extension: asset.extension, assetId: asset.id }));
      const virtualEvidence: Citation[] = networkNodes.filter((node) => node.data.documentContent?.trim()).map((node) => ({ chunkId: `canvas:${node.id}`, assetId: `canvas:${node.id}`, source: node.data.title, sourcePath: '', locator: '画布文档正文', text: node.data.documentContent || '', score: 1 }));
      const parentFolder = state.nodes.find((node) => node.data.kind === 'folder' && networkIds.length > 0 && networkIds.every((id) => (node.data.childNodeIds || []).includes(id)));
      const centerX = networkNodes.length ? networkNodes.reduce((sum, node) => sum + node.position.x, 0) / networkNodes.length : 520;
      const centerY = networkNodes.length ? networkNodes.reduce((sum, node) => sum + node.position.y, 0) / networkNodes.length : 220;
      const position = { x: centerX + 80, y: centerY + 130 };
      const names = networkNodes.map((node) => node.data.title);
      try {
        if (networkNodes.length < 2) throw new Error('这条连接线上没有检测到至少两份可分析的文件');
        notify(action === 'ai-analysis' ? `正在融合分析 ${networkNodes.length} 份相连资料…` : action === 'image-generation' ? `正在根据 ${networkNodes.length} 份资料生成图像…` : '已提交视频生成，可能需要几分钟…');
        if (assetIds.length) await window.desktop.ensureKnowledgeIndexed(assetIds);
        const evidence = [...(assetIds.length ? await window.desktop.readKnowledge(assetIds) : []), ...virtualEvidence];
        const context = evidence.slice(0, 6).map((item, index) => `[${index + 1}] ${item.source}\n${item.text}`).join('\n\n');
        if (action === 'ai-analysis') {
          const result = await window.desktop.generateAIAnswer({ question: `${instructions}\n\n请融合分析以下 ${networkNodes.length} 份相连资料，并生成一份新的、逻辑完整的文档：\n${names.map((name, index) => `${index + 1}. ${name}`).join('\n')}`, evidence, attachments, instructions: `${instructions}\n\n你正在处理一个由连线组成的资料组，而不只是单条连线的两个端点。已在本地解析并附上所有相连文档的正文与图片，请逐份识别、综合比较并形成完整新文档，不要声称无法读取附件。\n\n请使用清晰的 Markdown 排版：用标题组织结构，分段表达，使用列表与加粗突出重点。` });
          const resultId = state.addNode({ kind: 'answer', title: networkNodes.length > 2 ? '多文件 AI 融合' : '连线 AI 分析', subtitle: `融合 ${networkNodes.length} 份资料 · ${evidence.length} 条引用`, body: result.text, citations: evidence }, position);
          useCanvasStore.getState().connectResult(edgeId, resultId);
          if (parentFolder) useCanvasStore.getState().attachNodesToFolder(parentFolder.id, [resultId]);
          notify(`${networkNodes.length} 份相连资料已融合生成新文档`);
          return;
        }
        const prompt = `${instructions}\n\n关联资料（共 ${networkNodes.length} 份）：\n${names.join('\n')}${context ? `\n\n参考内容：\n${context}` : ''}`;
        const media = await window.desktop.generateMedia({ type: action, prompt, model });
        if (media.path) {
          const imported = await window.desktop.ingestPaths([media.path]);
          state.setAssets(imported.assets); state.addAssetNodes(imported.roots, position);
          if (parentFolder) {
            const rootIds = new Set(imported.roots.map((asset) => asset.id));
            const generatedIds = useCanvasStore.getState().nodes.filter((node) => node.data.assetId && rootIds.has(node.data.assetId)).map((node) => node.id);
            useCanvasStore.getState().attachNodesToFolder(parentFolder.id, generatedIds);
          }
          notify(action === 'image-generation' ? '图像已生成并放入画布' : '视频已生成并放入画布');
        } else notify(`生成任务状态：${media.status}`);
      } catch (error) { notify(error instanceof Error ? error.message : '连线 AI 动作执行失败'); }
    };
    window.addEventListener('run-edge-action', runEdgeAction);
    return () => window.removeEventListener('run-edge-action', runEdgeAction);
  }, [notify]);

  useEffect(() => {
    if (!store.hydrated) return;
    const pages = canvasPages.map((page) => page.id === activeCanvasId ? { ...page, nodes: store.nodes, edges: store.edges } : page);
    const timer = window.setTimeout(() => void window.desktop.saveWorkspace({ nodes: store.nodes, edges: store.edges, assets: store.assets, revision: store.revision, canvases: pages, activeCanvasId }), 450);
    return () => window.clearTimeout(timer);
  }, [store.nodes, store.edges, store.assets, store.revision, store.hydrated, canvasPages, activeCanvasId]);

  const switchCanvas = (id: string) => {
    if (id === activeCanvasId) return;
    const target = canvasPages.find((page) => page.id === id);
    if (!target) return;
    const current = useCanvasStore.getState();
    setCanvasPages((pages) => pages.map((page) => page.id === activeCanvasId ? { ...page, nodes: structuredClone(current.nodes), edges: structuredClone(current.edges) } : page));
    setActiveCanvasId(id); current.replaceCanvas(target.nodes, target.edges);
    setDrawer(null); setFolderAssetId(undefined); setFolderNodeId(undefined);
  };

  const createCanvas = () => {
    setCanvasNameDialog({ mode: 'create', title: `新画布 ${canvasPages.length + 1}` });
  };

  const commitCanvasName = () => {
    if (!canvasNameDialog) return;
    const title = canvasNameDialog.title.trim();
    if (!title) { notify('请输入画布名称'); return; }
    if (canvasNameDialog.mode === 'rename' && canvasNameDialog.id) {
      setCanvasPages((pages) => pages.map((item) => item.id === canvasNameDialog.id ? { ...item, title } : item));
      setCanvasNameDialog(null);
      notify(`画布已重命名为“${title}”`);
      return;
    }
    const current = useCanvasStore.getState();
    const page: CanvasPage = { id: crypto.randomUUID(), title, nodes: [], edges: [] };
    setCanvasPages((pages) => [...pages.map((item) => item.id === activeCanvasId ? { ...item, nodes: structuredClone(current.nodes), edges: structuredClone(current.edges) } : item), page]);
    setActiveCanvasId(page.id); current.replaceCanvas([], []);
    setCanvasNameDialog(null);
    notify(`已新建画布“${title}”`);
  };

  const renameCanvas = (id: string) => {
    const page = canvasPages.find((item) => item.id === id); if (!page) return;
    setCanvasNameDialog({ mode: 'rename', id, title: page.title });
  };

  useEffect(() => {
    let controlTap = false;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if ((target instanceof HTMLElement && target.matches('input,textarea,[contenteditable="true"]')) || event.isComposing) return;
      if (event.key === 'Control') { controlTap = !event.repeat; return; }
      if (event.ctrlKey) controlTap = false;
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const state = useCanvasStore.getState();
      if (command && key === 'z') { event.preventDefault(); state.undo(); return; }
      if (command && key === 'c') { event.preventDefault(); copySelection(); return; }
      if (command && key === 'v') { event.preventDefault(); pasteSelection(undefined, folderNodeId); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelection();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Control') return;
      if (controlTap) {
        event.preventDefault();
        const state = useCanvasStore.getState();
        const next = state.interactionMode === 'pan' ? 'select' : 'pan';
        state.setInteractionMode(next);
        notify(next === 'select' ? '已切换到框选模式' : '已切换到拖动画布模式');
      }
      controlTap = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [copySelection, deleteSelection, folderNodeId, notify, pasteSelection]);

  const organizeUnconnected = useCallback(() => {
    const state = useCanvasStore.getState();
    const connectedIds = new Set(state.edges.flatMap((edge) => [edge.source, edge.target]));
    const looseNodes = state.nodes.filter((node) => !connectedIds.has(node.id)).sort((a, b) => a.data.title.localeCompare(b.data.title, 'zh-CN', { numeric: true }));
    if (!looseNodes.length) { notify('没有需要整理的未连接项目'); return; }

    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(looseNodes.length))));
    const rows = Math.ceil(looseNodes.length / columns);
    const gap = 42;
    const widths = Array.from({ length: columns }, () => 0);
    const heights = Array.from({ length: rows }, () => 0);
    looseNodes.forEach((node, index) => {
      const column = index % columns; const row = Math.floor(index / columns);
      widths[column] = Math.max(widths[column], nodeSize(node, 'width'));
      heights[row] = Math.max(heights[row], nodeSize(node, 'height'));
    });
    const groupWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (columns - 1);
    const rect = canvasRef.current?.getBoundingClientRect();
    const visibleTopRight = flow.screenToFlowPosition({ x: (rect?.right || window.innerWidth) - 50, y: (rect?.top || 55) + 60 });
    const connected = state.nodes.filter((node) => connectedIds.has(node.id));
    const connectedRight = connected.length ? Math.max(...connected.map((node) => node.position.x + nodeSize(node, 'width'))) : Number.NEGATIVE_INFINITY;
    const startX = Math.max(visibleTopRight.x - groupWidth, connectedRight + 100);
    const startY = visibleTopRight.y;
    const columnOffsets = widths.map((_width, column) => widths.slice(0, column).reduce((sum, width) => sum + width + gap, 0));
    const rowOffsets = heights.map((_height, row) => heights.slice(0, row).reduce((sum, height) => sum + height + gap, 0));
    const positions = Object.fromEntries(looseNodes.map((node, index) => [node.id, { x: startX + columnOffsets[index % columns], y: startY + rowOffsets[Math.floor(index / columns)] }]));
    state.repositionNodes(positions);
    notify(`已将 ${looseNodes.length} 个未连接项目整理到右上方`);
  }, [flow, notify]);

  const runQuestion = async () => {
    if (!question.trim()) return;
    setAnswer({ text: '', citations: [], loading: true });
    try {
      const assetIds = collectScope(undefined, store.nodes, store.edges);
      await window.desktop.ensureKnowledgeIndexed(assetIds);
      const citations = await window.desktop.searchKnowledge({ query: question, assetIds, ensureCoverage: true });
      const settings = await window.desktop.getAISettings();
      if (!settings.configured) {
        const text = citations.length ? `尚未配置 AI，以下是本地检索到的关键证据：\n\n${citations.map((item, index) => `[${index + 1}] ${item.source} · ${item.locator}\n${item.text}`).join('\n\n')}` : '没有检索到相关证据。请导入资料或换一种问法。';
        setAnswer({ text, citations });
      } else {
        const result = await window.desktop.generateAIAnswer({ question, evidence: citations, instructions: `${globalPrompt || settings.instructions}\n\n请使用清晰的 Markdown 排版：使用简短标题、分段、列表和加粗突出重点，避免连续大段文字。` });
        setAnswer({ text: result.text, citations });
      }
    } catch (error) { setAnswer({ text: error instanceof Error ? error.message : '回答失败', citations: [] }); }
  };

  const saveGlobalPrompt = async () => {
    const current = await window.desktop.getAISettings();
    await window.desktop.saveAISettings({ ...current, instructions: globalPrompt });
    setGlobalPromptOpen(false); notify('全局资料提问的系统提示词已保存');
  };

  const createAt = (kind: CanvasNodeData['kind'], title: string) => {
    const position = contextMenu ? flow.screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y }) : flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
    store.addNode({ kind, title, subtitle: labelForKind(kind) }, position);
    setContextMenu(null);
  };

  const createDocument = (documentType: 'txt' | 'word') => {
    const position = contextMenu ? flow.screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y }) : flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
    const id = store.addNode({ kind: 'file', title: documentType === 'txt' ? '新建文本文档.txt' : '新建 Word 文档.docx', subtitle: documentType === 'txt' ? 'TXT 文档' : 'Word 文档', documentType, documentContent: '', status: 'virtual' }, position);
    setContextMenu(null); setDocumentNodeId(id);
  };

  const createKnowledgeFromTemplate = (templateId: string) => {
    const template = knowledgeTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const offset = store.nodes.filter((node) => node.data.kind === 'knowledge-base').length * 28;
    store.addNode({ kind: 'knowledge-base', title: template.title, subtitle: `知识库模板 · ${template.description}`, instructions: template.instructions }, flow.screenToFlowPosition({ x: window.innerWidth * .58 + offset, y: 210 + offset }));
    setDrawer(null);
    notify(`已创建“${template.title}”知识库`);
  };

  const locateNode = useCallback((id: string) => {
    const state = useCanvasStore.getState();
    const node = state.nodes.find((item) => item.id === id);
    if (!node) return;
    setDrawer(null);
    state.selectNodes([id]);
    state.setLocated(id);
    if (locationTimerRef.current) window.clearTimeout(locationTimerRef.current);
    locationTimerRef.current = window.setTimeout(() => {
      if (useCanvasStore.getState().locatedId === id) useCanvasStore.getState().setLocated(undefined);
    }, 2400);
    flow.setCenter(node.position.x + nodeSize(node, 'width') / 2, node.position.y + nodeSize(node, 'height') / 2, { zoom: Math.max(flow.getZoom(), 1.05), duration: 500 });
    notify(`已定位：${node.data.title}`);
  }, [flow, notify]);

  const nodeClick: NodeMouseHandler = (_event, node) => store.setSelected(node.id);
  const nodeContextMenu: NodeMouseHandler = (event, node) => {
    event.preventDefault(); event.stopPropagation();
    const state = useCanvasStore.getState();
    if (!node.selected) state.selectNodes([node.id]);
    setContextMenu({ x: event.clientX, y: event.clientY, kind: 'selection' });
  };

  const edgeContextMenu = (event: React.MouseEvent, edge: CanvasEdge) => {
    event.preventDefault(); event.stopPropagation();
    useCanvasStore.getState().selectEdge(edge.id);
    setContextMenu({ x: event.clientX, y: event.clientY, kind: 'edge', edgeId: edge.id });
  };

  const openCanvasContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const state = useCanvasStore.getState();
    const hasSelection = state.nodes.some((node) => node.selected);
    setContextMenu({ x: event.clientX, y: event.clientY, kind: state.interactionMode === 'select' && hasSelection ? 'selection' : 'canvas' });
  };

  const finishQuickChatDrop = useCallback((clientX: number, clientY: number) => {
    const origin = dragOriginRef.current;
    if (!quickOpen || !Object.keys(origin).length) return false;
    const rect = document.querySelector('.quick-chat-drawer')?.getBoundingClientRect();
    if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
    const state = useCanvasStore.getState();
    const draggedNodes = state.nodes.filter((item) => Boolean(origin[item.id]));
    for (const dragged of draggedNodes) {
      const asset = state.assets.find((item) => item.id === dragged.data.assetId);
      if (asset) window.dispatchEvent(new CustomEvent('quick-chat-canvas-attach', { detail: { asset } }));
    }
    const changes = draggedNodes.map((dragged) => ({ id: dragged.id, type: 'position' as const, position: origin[dragged.id], dragging: false }));
    const viewport = dragViewportRef.current;
    const restore = () => {
      if (changes.length) useCanvasStore.getState().onNodesChange(changes);
      if (viewport) void flow.setViewport(viewport, { duration: 180 });
    };
    restore();
    // React Flow may emit one final drag position after pointer-up; restore once more after that event settles.
    window.setTimeout(restore, 80);
    dragOriginRef.current = {};
    dragViewportRef.current = null;
    quickDropHandledRef.current = true;
    notify(`已添加 ${draggedNodes.length} 个附件，画布文件已自动归位`);
    return true;
  }, [flow, notify, quickOpen]);

  useEffect(() => {
    const pointerUp = (event: PointerEvent | MouseEvent) => { finishQuickChatDrop(event.clientX, event.clientY); };
    window.addEventListener('pointerup', pointerUp, true);
    window.addEventListener('mouseup', pointerUp, true);
    return () => { window.removeEventListener('pointerup', pointerUp, true); window.removeEventListener('mouseup', pointerUp, true); };
  }, [finishQuickChatDrop]);

  const handleNodeDragStart = (_event: React.MouseEvent, node: CanvasNode) => {
    const state = useCanvasStore.getState();
    state.checkpoint();
    const draggedNodes = node.selected ? state.nodes.filter((item) => item.selected && !item.hidden) : [node];
    dragOriginRef.current = Object.fromEntries(draggedNodes.map((item) => [item.id, { ...item.position }]));
    dragViewportRef.current = flow.getViewport();
    quickDropHandledRef.current = false;
  };

  const handleNodeDragStop = (event: React.MouseEvent, node: CanvasNode) => {
    if (quickDropHandledRef.current) { quickDropHandledRef.current = false; return; }
    const state = useCanvasStore.getState();
    if (['file', 'folder'].includes(node.data.kind)) {
      const draggedNodes = node.selected ? state.nodes.filter((item) => item.selected && !item.hidden) : [node];
      const center = { x: node.position.x + nodeSize(node, 'width') / 2, y: node.position.y + nodeSize(node, 'height') / 2 };
      const draggedIds = new Set(draggedNodes.map((item) => item.id));
      const container = state.nodes.find((item) => !draggedIds.has(item.id) && ['knowledge-base', 'folder'].includes(item.data.kind) && !item.hidden && center.x >= item.position.x && center.x <= item.position.x + nodeSize(item, 'width') && center.y >= item.position.y && center.y <= item.position.y + nodeSize(item, 'height'));
      if (container) {
        const eligibleIds = draggedNodes.filter((item) => item.id !== container.id && (container.data.kind === 'folder' || ['file', 'folder'].includes(item.data.kind))).map((item) => item.id);
        if (container.data.kind === 'knowledge-base') state.attachNodesToKnowledge(container.id, eligibleIds);
        else state.attachNodesToFolder(container.id, eligibleIds);
        dragOriginRef.current = {};
        dragViewportRef.current = null;
        notify(`已将 ${eligibleIds.length} 个所选项收纳到“${container.data.title}”`);
        return;
      }
    }
    if (finishQuickChatDrop(event.clientX, event.clientY)) return;
    dragOriginRef.current = {};
    dragViewportRef.current = null;
  };

  return <main className={`desktop-shell theme-${theme}`} onClick={() => setContextMenu(null)}>
    <aside className="nav-rail">
      <div className="window-drag-region" />
      <div className="app-logo"><Sparkles size={18} /></div>
      <nav>
        <RailButton label="画布" active={!drawer} icon={<LayoutDashboard size={19} />} onClick={() => setDrawer(null)} />
        <RailButton label="资料" active={drawer === 'assets'} icon={<Folder size={19} />} onClick={() => setDrawer(drawer === 'assets' ? null : 'assets')} />
        <RailButton label="知识" active={drawer === 'knowledge'} icon={<Database size={19} />} onClick={() => setDrawer(drawer === 'knowledge' ? null : 'knowledge')} />
        <RailButton label="搜索" active={drawer === 'search'} icon={<Search size={19} />} onClick={() => setDrawer(drawer === 'search' ? null : 'search')} />
      </nav>
      <div className="rail-bottom"><RailButton label="状态" active={drawer === 'status'} icon={<Zap size={19} />} onClick={() => setDrawer(drawer === 'status' ? null : 'status')} /><RailButton label="设置" icon={<Settings size={19} />} onClick={() => setSettingsOpen(true)} /></div>
    </aside>

    <section className="main-workspace">
      <header className="app-topbar">
        <div className="workspace-name"><span className="workspace-logo"><Sparkles size={15} /></span><div className="canvas-tabs" role="tablist">{canvasPages.map((page) => <button role="tab" aria-selected={page.id === activeCanvasId} className={page.id === activeCanvasId ? 'active' : ''} key={page.id} onClick={() => switchCanvas(page.id)} onDoubleClick={() => renameCanvas(page.id)} title="点击切换，双击改名"><strong>{page.title}</strong><small>{page.id === activeCanvasId ? '当前画布 · 已自动保存' : '点击切换'}</small></button>)}<button className="new-canvas-tab" onClick={createCanvas} title="新建画布"><Plus size={15}/></button></div></div>
        <div className="topbar-actions"><button onClick={() => setDrawer('search')} className="top-search"><Search size={14} />搜索画布 <kbd>⌘ K</kbd></button><button className="icon-action" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); localStorage.setItem('wow-theme', next); }}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><button className={`ai-quick-button ${quickOpen ? 'active' : ''}`} onClick={() => setQuickOpen(!quickOpen)}><Sparkles size={15} />AI 快问</button></div>
      </header>
      <div ref={canvasRef} className="canvas-area" onContextMenu={openCanvasContextMenu}>
        <ReactFlow nodes={store.nodes} edges={store.edges} onNodesChange={store.onNodesChange} onEdgesChange={store.onEdgesChange} onConnect={store.connect} onNodeDragStart={handleNodeDragStart} onNodeDragStop={handleNodeDragStop} onNodeClick={nodeClick} onNodeContextMenu={nodeContextMenu} onEdgeClick={(_event, edge) => store.selectEdge(edge.id)} onEdgeContextMenu={edgeContextMenu} onPaneClick={() => store.setSelected(undefined)} nodeTypes={nodeTypes} edgeTypes={edgeTypes} selectionMode={SelectionMode.Partial} selectionOnDrag={store.interactionMode === 'select'} selectionKeyCode="Shift" panOnDrag={store.interactionMode === 'pan' ? true : [1, 2]} nodesDraggable connectionMode={ConnectionMode.Loose} isValidConnection={(connection) => connection.source !== connection.target} panOnScroll panActivationKeyCode="Space" minZoom={0.2} maxZoom={2} fitView deleteKeyCode={null} connectionRadius={48}>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls position="bottom-left" showInteractive />
          <MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => miniColor((node.data as CanvasNodeData).kind)} />
        </ReactFlow>
        <SelectionResizeOverlay />
        <div className="canvas-tools"><button onClick={() => void importPaths()}><Upload size={14} />导入资料</button><button onClick={organizeUnconnected} title="按名称排序未连接项目，并放到已连接项目右侧的画布右上方"><LayoutGrid size={14} />一键整理</button><span className="tool-divider"/><button className={store.interactionMode === 'select' ? 'active' : ''} onClick={() => store.setInteractionMode('select')} title="左键拉框多选；中键、右键或空格仍可拖动画布；Control 切换模式"><MousePointer2 size={14} />框选</button><button className={store.interactionMode === 'pan' ? 'active' : ''} onClick={() => store.setInteractionMode('pan')} title="左键拖动画布；按住 Shift 仍可临时框选；Control 切换模式"><Hand size={14} />拖动画布</button></div>
        <form className="global-question" onSubmit={(event) => { event.preventDefault(); void runQuestion(); }}><div><Sparkles size={13} /><span>全局 · {store.assets.filter((asset) => asset.kind === 'file').length} 份资料</span><ChevronDown size={12} /><button type="button" className="prompt-trigger" onClick={() => setGlobalPromptOpen(!globalPromptOpen)}><Settings size={12}/>系统提示词</button></div>{globalPromptOpen && <div className="global-prompt-popover" onClick={(event) => event.stopPropagation()}><header><strong>全局资料提问·系统提示词</strong><button type="button" onClick={() => setGlobalPromptOpen(false)}><X size={13}/></button></header><textarea value={globalPrompt} onChange={(event) => setGlobalPrompt(event.target.value)} placeholder="定义 AI 如何使用画布资料回答…"/><footer><span>对底部全局提问生效</span><button type="button" onClick={() => void saveGlobalPrompt()}>保存</button></footer></div>}<section><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="向整个画布提问，答案会附带来源…" /><button disabled={!question.trim()}><Send size={15} /></button></section></form>
        {videoAssetId && <CanvasVideoPlayer asset={store.assets.find((asset) => asset.id === videoAssetId)} onClose={() => setVideoAssetId(undefined)}/>}
      </div>
    </section>

    {drawer && <Drawer kind={drawer} assets={store.assets} nodes={store.nodes} onClose={() => setDrawer(null)} onImport={() => void importPaths()} onLocate={locateNode} onRename={(id, title) => store.updateNode(id, { title })} onCreateTemplate={createKnowledgeFromTemplate} />}
    {quickOpen && <QuickChat onClose={() => setQuickOpen(false)} />}
    {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} notify={notify} onSaved={(settings) => setGlobalPrompt(settings.instructions)} />}
    {canvasNameDialog && <div className="modal-layer canvas-name-layer"><form className="canvas-name-dialog" onSubmit={(event) => { event.preventDefault(); commitCanvasName(); }}><header><div><span><LayoutDashboard size={17}/></span><div><strong>{canvasNameDialog.mode === 'create' ? '新建画布' : '重命名画布'}</strong><small>每个画布都会独立保存节点和连接线</small></div></div><button type="button" onClick={() => setCanvasNameDialog(null)}><X size={16}/></button></header><label>画布名称<input autoFocus value={canvasNameDialog.title} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setCanvasNameDialog({ ...canvasNameDialog, title: event.target.value })} placeholder="请输入画布名称"/></label><footer><button type="button" onClick={() => setCanvasNameDialog(null)}>取消</button><button className="primary" type="submit"><Plus size={13}/>{canvasNameDialog.mode === 'create' ? '新建画布' : '保存名称'}</button></footer></form></div>}
    {answer && <AnswerDialog result={answer} onClose={() => setAnswer(null)} onSave={() => { if (!answer.loading) { store.addNode({ kind: 'answer', title: 'AI 分析结论', subtitle: `结论 · ${answer.citations.length} 条引用`, body: answer.text, citations: answer.citations }, flow.screenToFlowPosition({ x: innerWidth * .72, y: innerHeight * .45 })); setAnswer(null); notify('已保存为结论节点'); } }} />}
    {documentNodeId && <DocumentEditor nodeId={documentNodeId} onClose={() => setDocumentNodeId(undefined)} notify={notify}/>} 
    {(folderAssetId || folderNodeId) && <FolderCanvas assetId={folderAssetId} nodeId={folderNodeId} onClose={() => { setFolderAssetId(undefined); setFolderNodeId(undefined); }} onImport={() => void importPaths()} onCopy={copySelection} onPaste={() => folderNodeId && pasteSelection(undefined, folderNodeId)} canPaste={Boolean(folderNodeId && clipboardRef.current?.nodes.length)} notify={notify} />}
    {contextMenu && <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>{contextMenu.kind === 'edge' ? <><div className="context-menu-title">连接线操作</div><button className="danger" onClick={() => { if (contextMenu.edgeId) store.removeEdges([contextMenu.edgeId]); setContextMenu(null); notify('连接线已删除，相关文件保留不变'); }}><Trash2 size={14}/>仅删除连接线 <kbd>⌫</kbd></button></> : contextMenu.kind === 'selection' ? <><div className="context-menu-title">批量操作 · {store.nodes.filter((node) => node.selected).length} 项</div><button onClick={() => { copySelection(); setContextMenu(null); }}><Copy size={14} />复制 <kbd>⌘C</kbd></button><button disabled={!clipboardRef.current?.nodes.length} onClick={() => { pasteSelection({ x: contextMenu.x, y: contextMenu.y }); setContextMenu(null); }}><ClipboardPaste size={14} />粘贴 <kbd>⌘V</kbd></button><hr/><button className="danger" onClick={() => { deleteSelection(); setContextMenu(null); }}><Trash2 size={14} />删除 <kbd>⌫</kbd></button></> : <><button onClick={() => void importPaths()}><Upload size={14} />导入文件或文件夹…</button><hr/><button onClick={() => createDocument('txt')}><FileText size={14}/>新建 TXT 文档</button><button onClick={() => createDocument('word')}><FilePlus2 size={14}/>新建 Word 文档</button><button onClick={() => createAt('folder', '新建画布文件夹')}><FolderPlus size={14} />新建画布文件夹</button><button onClick={() => createAt('knowledge-base', '新建知识库')}><Database size={14} />新建知识库</button><button onClick={() => createAt('ai', 'AI 分析')}><Bot size={14} />新建 AI 节点</button></>}</div>}
    {toast && <div className="app-toast"><Check size={14} />{toast}</div>}
  </main>;
}

type GroupResizeCorner = 'nw' | 'ne' | 'se' | 'sw';

function SelectionResizeOverlay() {
  const nodes = useCanvasStore((state) => state.nodes);
  const interactionMode = useCanvasStore((state) => state.interactionMode);
  const viewport = useViewport();
  const selected = useMemo(() => nodes.filter((node) => node.selected && !node.hidden), [nodes]);
  const bounds = useMemo(() => {
    if (selected.length < 2) return null;
    const left = Math.min(...selected.map((node) => node.position.x));
    const top = Math.min(...selected.map((node) => node.position.y));
    const right = Math.max(...selected.map((node) => node.position.x + nodeSize(node, 'width')));
    const bottom = Math.max(...selected.map((node) => node.position.y + nodeSize(node, 'height')));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }, [selected]);

  if (interactionMode !== 'select' || !bounds) return null;

  const startResize = (corner: GroupResizeCorner, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest('.canvas-area') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const snapshot = selected.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      position: { ...node.position },
      width: nodeSize(node, 'width'),
      height: nodeSize(node, 'height'),
    }));
    const fixed = {
      x: corner.includes('e') ? bounds.left : bounds.right,
      y: corner.includes('s') ? bounds.top : bounds.bottom,
    };
    const dragged = {
      x: corner.includes('e') ? bounds.right : bounds.left,
      y: corner.includes('s') ? bounds.bottom : bounds.top,
    };
    const vector = { x: dragged.x - fixed.x, y: dragged.y - fixed.y };
    const denominator = vector.x * vector.x + vector.y * vector.y;
    let minScale = 0.08;
    let maxScale = 8;
    for (const node of snapshot) {
      const desktop = node.kind === 'file' || node.kind === 'folder';
      const minWidth = desktop ? 78 : node.kind === 'ai' || node.kind === 'answer' ? 280 : 160;
      const minHeight = desktop ? 78 : node.kind === 'ai' ? 190 : node.kind === 'answer' ? 170 : 100;
      const maxWidth = desktop ? 480 : 720;
      const maxHeight = desktop ? 480 : 620;
      minScale = Math.max(minScale, minWidth / node.width, minHeight / node.height);
      maxScale = Math.min(maxScale, maxWidth / node.width, maxHeight / node.height);
    }
    useCanvasStore.getState().checkpoint();

    const move = (moveEvent: PointerEvent) => {
      const current = {
        x: (moveEvent.clientX - rect.left - viewport.x) / viewport.zoom,
        y: (moveEvent.clientY - rect.top - viewport.y) / viewport.zoom,
      };
      const projected = denominator > 0
        ? ((current.x - fixed.x) * vector.x + (current.y - fixed.y) * vector.y) / denominator
        : 1;
      const scale = Math.max(minScale, Math.min(maxScale, projected));
      const layout = Object.fromEntries(snapshot.map((node) => [node.id, {
        position: {
          x: fixed.x + (node.position.x - fixed.x) * scale,
          y: fixed.y + (node.position.y - fixed.y) * scale,
        },
        width: node.width * scale,
        height: node.height * scale,
      }]));
      useCanvasStore.getState().resizeNodes(layout);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  return <div className="selection-resize-overlay" data-count={`${selected.length} 项`} style={{
    left: bounds.left * viewport.zoom + viewport.x,
    top: bounds.top * viewport.zoom + viewport.y,
    width: bounds.width * viewport.zoom,
    height: bounds.height * viewport.zoom,
  }}>
    {(['nw', 'ne', 'se', 'sw'] as GroupResizeCorner[]).map((corner) => <button key={corner} type="button" aria-label={`整体缩放 ${corner}`} className={`selection-group-handle ${corner}`} onPointerDown={(event) => startResize(corner, event)} />)}
  </div>;
}

function RailButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active?: boolean; onClick: () => void }) { return <button title={label} aria-label={label} onClick={onClick} className={active ? 'active' : ''}>{icon}</button>; }
function nodeSize(node: CanvasNode, axis: 'width' | 'height') {
  const measured = node.measured?.[axis];
  const explicit = node[axis];
  const styled = Number(node.style?.[axis]);
  if (typeof measured === 'number' && measured > 0) return measured;
  if (typeof explicit === 'number' && explicit > 0) return explicit;
  if (Number.isFinite(styled) && styled > 0) return styled;
  if (node.data.kind === 'file' || node.data.kind === 'folder') return 112;
  if (node.data.kind === 'ai') return axis === 'width' ? 320 : 230;
  return axis === 'width' ? 210 : 130;
}
function labelForKind(kind: CanvasNodeData['kind']) { return ({ file: '文件', folder: '画布文件夹', 'knowledge-base': '知识库', ai: 'AI 分析', answer: '结论' } as Record<string, string>)[kind]; }
function miniColor(kind: CanvasNodeData['kind']) { return ({ file: '#65a9d8', folder: '#d4a85e', 'knowledge-base': '#8178ff', ai: '#a59eff', answer: '#6599df', task: '#65d6a3', note: '#b9a867' } as Record<string, string>)[kind]; }

function Drawer({ kind, assets, nodes, onClose, onImport, onLocate, onRename, onCreateTemplate }: { kind: NonNullable<ReturnType<typeof useDrawerKind>>; assets: Asset[]; nodes: ReturnType<typeof useCanvasStore.getState>['nodes']; onClose: () => void; onImport: () => void; onLocate: (id: string) => void; onRename: (id: string, title: string) => void; onCreateTemplate: (templateId: string) => void }) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [titleDraft, setTitleDraft] = useState('');
  const titles = { assets: '资料', knowledge: '知识库', search: '搜索', status: '处理状态' };
  const nodeKinds = kind === 'knowledge' ? ['knowledge-base'] : [];
  const visibleNodes = nodes.filter((node) => (!nodeKinds.length || nodeKinds.includes(node.data.kind)) && (!query || `${node.data.title}${node.data.subtitle}`.toLowerCase().includes(query.toLowerCase())));
  const commitRename = (id: string, original: string) => { const title = titleDraft.trim(); if (title && title !== original) onRename(id, title); setEditingId(undefined); };
  return <aside className="left-drawer"><header><div><strong>{titles[kind]}</strong><small>{kind === 'assets' ? `${assets.length} 项本地资料` : '当前工作区'}</small></div><button onClick={onClose}><X size={15} /></button></header>{['assets','search'].includes(kind) && <label className="drawer-search"><Search size={13}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索节点或资料…"/></label>}{kind === 'assets' && <><button className="drawer-primary" onClick={onImport}><Upload size={14}/>添加文件或文件夹</button><div className="drawer-list">{assets.filter((asset) => !query || asset.name.toLowerCase().includes(query.toLowerCase())).map((asset) => <button key={asset.id} onClick={() => void window.desktop.openAsset(asset.path)}><span className={`list-icon ${asset.kind}`} >{asset.kind === 'folder' ? <Folder size={15}/> : <FileText size={15}/>}</span><div><strong>{asset.name}</strong><small>{asset.indexStatus} · {asset.kind === 'folder' ? `${asset.childCount || 0} 项` : formatSize(asset.size)}</small></div></button>)}</div></>}{kind === 'knowledge' && <section className="knowledge-template-section"><div className="drawer-section-heading"><div><strong>新建知识库</strong><small>选择模板快速开始</small></div><Library size={15}/></div><div className="knowledge-template-grid">{knowledgeTemplates.map((template) => <button key={template.id} onClick={() => onCreateTemplate(template.id)}><span><Database size={14}/></span><div><strong>{template.title}</strong><small>{template.description}</small></div></button>)}</div></section>}{['knowledge','search'].includes(kind) && <div className="drawer-list knowledge-list">{kind === 'knowledge' && <div className="drawer-section-label">已有知识库 · 双击名称可修改</div>}{visibleNodes.map((node) => <button key={node.id} onClick={() => editingId !== node.id && onLocate(node.id)}><span className="list-icon">{node.data.kind === 'knowledge-base' ? <Database size={15}/> : <FileSearch size={15}/>}</span><div>{editingId === node.id ? <input className="drawer-title-input" autoFocus value={titleDraft} onClick={(event) => event.stopPropagation()} onChange={(event) => setTitleDraft(event.target.value)} onBlur={() => commitRename(node.id, node.data.title)} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(node.id, node.data.title); if (event.key === 'Escape') setEditingId(undefined); }}/>:<strong title="双击修改名称" onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); setEditingId(node.id); setTitleDraft(node.data.title); }}>{node.data.title}</strong>}<small>{node.data.subtitle}</small></div>{kind === 'knowledge' && <Pencil className="drawer-edit-icon" size={12}/>}</button>)}</div>}{kind === 'status' && <div className="status-panel"><section><div className="status-circle">{assets.filter((asset) => asset.indexStatus === 'ready').length}</div><div><strong>本地资料处理概览</strong><small>索引只保存在本机</small></div></section><p><Check size={13}/>已完成索引 <b>{assets.filter((asset) => asset.indexStatus === 'ready').length}</b></p><p><Zap size={13}/>正在处理 <b>{assets.filter((asset) => ['processing','scanning'].includes(asset.indexStatus)).length}</b></p><p><AlertCircle size={13}/>处理失败 <b>{assets.filter((asset) => asset.indexStatus === 'failed').length}</b></p><p><Sparkles size={13}/>AI 结果节点 <b>{nodes.filter((node) => node.data.kind === 'answer').length}</b></p></div>}</aside>;
}
function useDrawerKind() { return null as 'assets' | 'knowledge' | 'search' | 'status' | null; }
function formatSize(size: number) { return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`; }

function QuickChat({ onClose }: { onClose: () => void }) {
  type ChatMessage = { role: 'user' | 'assistant'; content: string; attachmentNames?: string[] };
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const [promptOpen, setPromptOpen] = useState(false); const [instructions, setInstructions] = useState(defaultSettings.quickInstructions); const [attachments, setAttachments] = useState<AIAttachment[]>([]); const [dragActive, setDragActive] = useState(false); const [copiedIndex, setCopiedIndex] = useState<number>();
  useEffect(() => { void window.desktop.getAISettings().then((settings) => setInstructions(settings.quickInstructions)); }, []);
  const addAssets = useCallback((items: Asset[]) => setAttachments((current) => { const next = [...current]; for (const asset of items) if (asset.kind === 'file' && !next.some((item) => item.path === asset.path)) next.push({ assetId: asset.id, name: asset.name, path: asset.path, kind: asset.kind, extension: asset.extension }); return next.slice(-8); }), []);
  const addPaths = useCallback(async (paths: string[]) => { if (!paths.length) return; const result = await window.desktop.ingestPaths(paths); addAssets(result.roots); }, [addAssets]);
  useEffect(() => {
    const fileDrop = (event: Event) => { setDragActive(false); void addPaths((event as CustomEvent<{ paths: string[] }>).detail.paths); };
    const canvasDrop = (event: Event) => { setDragActive(false); addAssets([(event as CustomEvent<{ asset: Asset }>).detail.asset]); };
    window.addEventListener('quick-chat-file-drop', fileDrop); window.addEventListener('quick-chat-canvas-attach', canvasDrop);
    return () => { window.removeEventListener('quick-chat-file-drop', fileDrop); window.removeEventListener('quick-chat-canvas-attach', canvasDrop); };
  }, [addAssets, addPaths]);
  const savePrompt = async () => { const settings = await window.desktop.getAISettings(); await window.desktop.saveAISettings({ ...settings, quickInstructions: instructions }); setPromptOpen(false); };
  const send = async () => { if ((!input.trim() && !attachments.length) || loading) return; const question = input.trim() || '请识别并分析这些附件。'; const sending = [...attachments]; const next: ChatMessage[] = [...messages, { role: 'user', content: question, attachmentNames: sending.map((item) => item.name) }]; setMessages(next); setInput(''); setAttachments([]); setLoading(true); try { const settings = await window.desktop.getAISettings(); if (!settings.configured) setMessages([...next, { role: 'assistant', content: '请先在设置中配置 AI 服务，再使用图片或文档识别。' }]); else { const documentIds = sending.filter((item) => !isImageAttachment(item) && item.assetId).map((item) => item.assetId!); if (documentIds.length) await window.desktop.ensureKnowledgeIndexed(documentIds); const evidence = documentIds.length ? await window.desktop.readKnowledge(documentIds) : []; const result = await window.desktop.generateAIAnswer({ question, evidence, attachments: sending, history: messages.slice(-10).map(({ role, content }) => ({ role, content })), instructions: `${instructions || settings.quickInstructions}\n\n已在本地读取所有附件文档的正文。请结合图片内容与文档正文回答，不要声称无法读取已附上的文档。` }); setMessages([...next, { role: 'assistant', content: result.text }]); } } catch (error) { setMessages([...next, { role: 'assistant', content: error instanceof Error ? error.message : '请求失败' }]); } finally { setLoading(false); } };
  const pickAttachments = async () => { try { await addPaths(await window.desktop.pickAssets()); } catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : '附件添加失败' }]); } };
  return <aside className={`quick-chat-drawer ${dragActive ? 'is-dragging' : ''}`} onDragEnter={() => setDragActive(true)} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDragOver={(event) => event.preventDefault()}><header><div><span><Sparkles size={18}/></span><div><strong>AI 快问</strong><small>支持图片与文档识别</small></div></div><div className="chat-header-actions"><button onClick={() => setPromptOpen(!promptOpen)} title="设置系统提示词"><Settings size={16}/></button><button onClick={onClose} aria-label="关闭 AI 快问"><X size={18}/></button></div></header>{promptOpen && <section className="chat-prompt-editor"><header><strong>AI 快问·系统提示词</strong><span>只影响通用对话</span></header><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="定义 AI 快问的角色、语气和回答方式…"/><footer><button onClick={() => setPromptOpen(false)}>取消</button><button className="primary" onClick={() => void savePrompt()}>保存</button></footer></section>}<div className="privacy-note"><ShieldCheck size={14}/>仅在发送时处理你主动添加的附件</div><div className="chat-messages">{!messages.length && <div className="chat-welcome"><span className="chat-mark"><Image size={30}/></span><strong>提问，或添加附件</strong><span>可上传图片、PDF、Word、Markdown，也可在“拖动画布”模式下把画布文件直接拖到这里</span><button className="chat-welcome-upload" onClick={() => void pickAttachments()}><Paperclip size={13}/>选择图片或文档</button></div>}{messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span>{message.role === 'assistant' ? <Sparkles size={14}/> : '你'}</span><div className="chat-message-body">{Boolean(message.attachmentNames?.length) && <div className="sent-attachments">{message.attachmentNames?.map((name) => <span key={name}><Paperclip size={10}/>{name}</span>)}</div>}{message.role === 'assistant' ? <><MarkdownContent text={message.content}/><button className="chat-message-copy" title="一键复制全部回答" onClick={() => { void window.desktop.writeClipboard(message.content).then(() => { setCopiedIndex(index); window.setTimeout(() => setCopiedIndex(undefined), 1400); }); }}>{copiedIndex === index ? <Check size={12}/> : <Copy size={12}/>}<span>{copiedIndex === index ? '已复制' : '复制'}</span></button></> : <p>{message.content}</p>}</div></div>)}{loading && <div className="chat-message assistant"><span><Sparkles size={14}/></span><p>正在识别并思考…</p></div>}</div>{dragActive && <div className="chat-drop-overlay"><Upload size={28}/><strong>松开即可添加到本次提问</strong><span>支持画布图片、文档和本地文件</span></div>}<form onSubmit={(event) => { event.preventDefault(); void send(); }}>{Boolean(attachments.length) && <div className="chat-attachments">{attachments.map((item) => <span key={item.path}>{isImageAttachment(item) ? <Image size={12}/> : <FileText size={12}/>}<b>{item.name}</b><button type="button" onClick={() => setAttachments((current) => current.filter((entry) => entry.path !== item.path))}><X size={11}/></button></span>)}</div>}<textarea autoFocus value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={attachments.length ? '针对附件提问…' : '给 AI 发送消息，或拖入图片/文档…'}/><footer><button type="button" className="chat-attach-button" onClick={() => void pickAttachments()} title="添加图片或文档"><Paperclip size={15}/></button><span>Enter 发送 · 最多 8 个附件</span><button className="chat-send-button" disabled={(!input.trim() && !attachments.length) || loading}><Send size={16}/></button></footer></form></aside>;
}

function isImageAttachment(item: AIAttachment) { return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(item.extension.toLowerCase()); }

function SettingsDialog({ onClose, notify, onSaved }: { onClose: () => void; notify: (message: string) => void; onSaved: (settings: AISettings) => void }) {
  const [settings, setSettings] = useState(defaultSettings); const [apiKey, setApiKey] = useState(''); const [testing, setTesting] = useState(false); const [tab, setTab] = useState<'model' | 'knowledge' | 'quick' | 'privacy'>('model');
  useEffect(() => { void window.desktop.getAISettings().then(setSettings); }, []);
  const save = async () => { try { const next = await window.desktop.saveAISettings({ ...settings, apiKey }); setSettings(next); setApiKey(''); onSaved(next); notify('AI 设置已安全保存'); onClose(); } catch (error) { notify(error instanceof Error ? error.message : '保存失败'); } };
  const test = async () => { setTesting(true); try { await window.desktop.saveAISettings({ ...settings, apiKey }); const result = await window.desktop.testAIConnection(); notify(result.message); } catch (error) { notify(error instanceof Error ? error.message : '连接失败'); } finally { setTesting(false); } };
  const selectProvider = (provider: string) => setSettings({ ...settings, provider, ...(provider === 'deepseek' ? { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' } : provider === 'openai' ? { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4' } : {}) });
  return <div className="modal-layer"><section className="settings-modal"><header><div><span><Settings size={17}/></span><div><strong>AI 与 API 设置</strong><small>模型、系统提示词与本地数据策略</small></div></div><button onClick={onClose}><X size={16}/></button></header><div className="settings-content"><nav><button className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')}>模型服务</button><button className={tab === 'knowledge' ? 'active' : ''} onClick={() => setTab('knowledge')}>资料问答</button><button className={tab === 'quick' ? 'active' : ''} onClick={() => setTab('quick')}>AI 快问</button><button className={tab === 'privacy' ? 'active' : ''} onClick={() => setTab('privacy')}>隐私与数据</button></nav><div className="settings-form">{tab === 'model' && <><div className="settings-section-title"><strong>模型服务</strong><span>配置所有 AI 功能共用的模型端点</span></div><label>服务商<select value={settings.provider} onChange={(event) => selectProvider(event.target.value)}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="compatible">其他 OpenAI 兼容服务</option></select></label><label>API 地址<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}/><small>{settings.provider === 'deepseek' ? 'DeepSeek 官方 OpenAI 兼容接口，无需添加 /v1' : '请填写服务商的 API 基址'}</small></label><label>模型<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })}/><small>{settings.provider === 'deepseek' ? '推荐：deepseek-v4-flash；也可使用 deepseek-v4-pro' : '填写服务商支持的模型名称'}</small></label><label>DeepSeek API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.keyHint || '输入 DeepSeek API Key'}/><small>留空不会覆盖已保存的密钥</small></label><button className="test-connection" onClick={() => void test()} disabled={testing}><Zap size={13}/>{testing ? '正在测试…' : '测试 DeepSeek 连接'}</button><div className="security-callout"><ShieldCheck size={16}/><div><strong>密钥不会进入渲染进程</strong><span>只在 Electron 主进程解密并调用模型服务。</span></div></div></>}{tab === 'knowledge' && <><div className="settings-section-title"><strong>资料问答</strong><span>适用于画布底部的全局提问，AI 节点可单独覆盖</span></div><label>系统提示词<textarea className="large-prompt" value={settings.instructions} onChange={(event) => setSettings({ ...settings, instructions: event.target.value })} placeholder="定义如何检索、引用和回答画布资料…"/><small>建议保留“证据不足时不得编造”等约束。</small></label><div className="prompt-scope-card"><Sparkles size={16}/><div><strong>生效位置</strong><span>全局资料提问 · 新建 AI 分析节点的默认值</span></div></div></>}{tab === 'quick' && <><div className="settings-section-title"><strong>AI 快问</strong><span>与画布资料隔离的通用对话助手</span></div><label>系统提示词<textarea className="large-prompt" value={settings.quickInstructions} onChange={(event) => setSettings({ ...settings, quickInstructions: event.target.value })} placeholder="定义 AI 快问的角色、语气与回答方式…"/></label><div className="prompt-scope-card"><ShieldCheck size={16}/><div><strong>独立上下文</strong><span>AI 快问不会自动读取画布文件和节点</span></div></div></>}{tab === 'privacy' && <><div className="settings-section-title"><strong>隐私与数据</strong><span>查看当前应用的数据边界</span></div><div className="privacy-settings"><section><ShieldCheck size={18}/><div><strong>本地优先存储</strong><span>画布、文件索引和聊天界面状态保存在本机。</span></div></section><section><Settings size={18}/><div><strong>系统安全存储</strong><span>API Key 经 macOS 安全存储加密，不暴露给页面代码。</span></div></section><section><Sparkles size={18}/><div><strong>最小化模型请求</strong><span>资料问答只提交检索命中的证据片段，不上传完整文件。</span></div></section></div></>}</div></div><footer><button onClick={onClose}>取消</button><button className="primary" onClick={() => void save()}>保存设置</button></footer></section></div>;
}

function DocumentEditor({ nodeId, onClose, notify }: { nodeId: string; onClose: () => void; notify: (message: string) => void }) {
  const node = useCanvasStore((state) => state.nodes.find((item) => item.id === nodeId));
  const updateNode = useCanvasStore((state) => state.updateNode);
  const [title, setTitle] = useState(node?.data.title || '未命名文档');
  const [content, setContent] = useState(node?.data.documentContent || '');
  const editorRef = useRef<HTMLDivElement>(null);
  const isWord = node?.data.documentType === 'word';
  useEffect(() => { if (isWord && editorRef.current) editorRef.current.innerHTML = node?.data.documentContent || ''; }, [isWord, nodeId]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(false); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
  if (!node) return null;
  const save = (close = true) => {
    const html = isWord ? (editorRef.current?.innerHTML || content) : content;
    const plain = isWord ? (editorRef.current?.innerText || '') : content;
    updateNode(nodeId, { title: title.trim() || node.data.title, documentContent: html, body: plain, subtitle: isWord ? 'Word 文档 · 已保存' : 'TXT 文档 · 已保存' });
    notify('文档已保存到画布'); if (close) onClose();
  };
  const format = (command: 'bold' | 'italic' | 'insertUnorderedList') => { editorRef.current?.focus(); document.execCommand(command); setContent(editorRef.current?.innerHTML || ''); };
  return <div className="modal-layer"><section className="document-editor-modal"><header><div><span><FileText size={18}/></span><div><input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="文档名称"/><small>{isWord ? 'Word 文档' : 'TXT 文本文档'} · 自动保存在当前画布</small></div></div><button onClick={() => save()}><X size={17}/></button></header>{isWord && <nav><button onClick={() => format('bold')} title="加粗"><Bold size={15}/></button><button onClick={() => format('italic')} title="斜体"><Italic size={15}/></button><button onClick={() => format('insertUnorderedList')} title="项目符号"><List size={15}/></button><span>选中文字后使用格式工具</span></nav>}<div className="document-editor-body">{isWord ? <div ref={editorRef} className="word-editable" contentEditable suppressContentEditableWarning onInput={(event) => setContent(event.currentTarget.innerHTML)} data-placeholder="开始输入文档内容…"/> : <textarea autoFocus value={content} onChange={(event) => setContent(event.target.value)} placeholder="开始输入文本内容…"/>}</div><footer><span>⌘S 保存 · 内容随工作区保存在本机</span><button onClick={() => save(false)}><Save size={14}/>保存</button><button className="primary" onClick={() => save()}><Check size={14}/>完成</button></footer></section></div>;
}

function AnswerDialog({ result, onClose, onSave }: { result: { text: string; citations: Citation[]; loading?: boolean }; onClose: () => void; onSave: () => void }) {
  return <div className="modal-layer"><section className="answer-modal">
    <header><div><span><Sparkles size={17}/></span><div><strong>画布资料回答</strong><small>{result.loading ? '正在检索和分析…' : `${result.citations.length} 条引用证据`}</small></div></div><button onClick={onClose}><X size={16}/></button></header>
    <article>{result.loading ? <div className="answer-loading"><Sparkles size={22}/><span>正在本地检索资料并组织答案…</span></div> : <><div className="answer-text"><MarkdownContent text={result.text}/></div>{Boolean(result.citations.length) && <div className="answer-citations"><h3>来源引用 <span>{result.citations.length}</span></h3>{result.citations.map((item, index) => <button key={item.chunkId} onClick={() => void window.desktop.openAsset(item.sourcePath)}><b>[{index + 1}]</b><div><strong>{item.source}</strong><span>{item.locator} · {item.text.slice(0, 72)}…</span></div><ExternalLink size={12}/></button>)}</div>}</>}</article>
    <footer><span><ShieldCheck size={13}/>完整文件不会发送给 AI 服务</span><div><AnswerCopyButton text={result.text} disabled={result.loading}/><button className="primary" onClick={onSave} disabled={result.loading}><MessageSquareText size={13}/>保存为结论节点</button></div></footer>
  </section></div>;
}

function AnswerCopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (disabled || !text) return;
    await window.desktop.writeClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <button onClick={() => void copy()} disabled={disabled}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? '已复制' : '一键复制'}</button>;
}

function MarkdownContent({ text }: { text: string }) {
  return <div className="formatted-answer">{text.replace(/\r\n/g, '\n').split('\n').map((line, index) => {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { const content = inlineMarkdown(heading[2], index); return heading[1].length === 1 ? <h1 key={index}>{content}</h1> : heading[1].length === 2 ? <h2 key={index}>{content}</h2> : <h3 key={index}>{content}</h3>; }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) return <div className="formatted-list-item" key={index}><b>•</b><span>{inlineMarkdown(bullet[1], index)}</span></div>;
    const ordered = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (ordered) return <div className="formatted-list-item" key={index}><b>{ordered[1]}.</b><span>{inlineMarkdown(ordered[2], index)}</span></div>;
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) return <blockquote key={index}>{inlineMarkdown(quote[1], index)}</blockquote>;
    if (/^\s*---+\s*$/.test(line)) return <hr key={index}/>;
    if (!line.trim()) return <div className="formatted-gap" key={index}/>;
    return <p key={index}>{inlineMarkdown(line, index)}</p>;
  })}</div>;
}

function inlineMarkdown(text: string, lineKey: number) {
  return text.split(/(\*\*.+?\*\*|`.+?`|\[\d+\])/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${lineKey}-${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={`${lineKey}-${index}`}>{part.slice(1, -1)}</code>;
    if (/^\[\d+\]$/.test(part)) return <mark key={`${lineKey}-${index}`}>{part}</mark>;
    return part;
  });
}

function CanvasVideoPlayer({ asset, onClose }: { asset?: Asset; onClose: () => void }) {
  if (!asset) return null;
  return <section className="canvas-video-player nodrag nopan" onClick={(event) => event.stopPropagation()}><header><div><Play size={15}/><strong>{asset.name}</strong></div><button onClick={onClose} title="关闭视频"><X size={16}/></button></header><video src={`wow-media://asset/${encodeURIComponent(asset.id)}`} controls autoPlay playsInline/><footer><span>视频在主画布上方播放，不会跳出应用</span><button onClick={() => void window.desktop.revealAsset(asset.path)}><ExternalLink size={12}/>在 Finder 中显示</button></footer></section>;
}

function FolderCanvas({ assetId, nodeId, onClose, onImport, onCopy, onPaste, canPaste, notify }: { assetId?: string; nodeId?: string; onClose: () => void; onImport: () => void; onCopy: () => boolean; onPaste: () => void; canPaste: boolean; notify: (message: string) => void }) {
  const [children, setChildren] = useState<Asset[]>([]);
  const [innerMenu, setInnerMenu] = useState<{ x: number; y: number; kind: 'node' | 'edge' | 'canvas'; nodeId?: string; edgeId?: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const node = useCanvasStore((state) => state.nodes.find((item) => item.id === nodeId));
  const canvasNodes = useCanvasStore((state) => state.nodes);
  const canvasEdges = useCanvasStore((state) => state.edges);
  const assets = useCanvasStore((state) => state.assets);
  const detachNodeFromFolder = useCanvasStore((state) => state.detachNodeFromFolder);
  const attachNodesToFolder = useCanvasStore((state) => state.attachNodesToFolder);
  const addNode = useCanvasStore((state) => state.addNode);
  const removeNodes = useCanvasStore((state) => state.removeNodes);
  const removeEdges = useCanvasStore((state) => state.removeEdges);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const selectNodes = useCanvasStore((state) => state.selectNodes);
  const interactionMode = useCanvasStore((state) => state.interactionMode);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const connect = useCanvasStore((state) => state.connect);
  const selectEdge = useCanvasStore((state) => state.selectEdge);
  const repositionNodes = useCanvasStore((state) => state.repositionNodes);
  const canvasChildren = (node?.data.childNodeIds || []).map((id) => canvasNodes.find((item) => item.id === id)).filter(Boolean) as CanvasNode[];
  const childIds = new Set(canvasChildren.map((child) => child.id));
  const innerNodes = canvasChildren.map((child) => ({ ...child, hidden: false }));
  const innerEdges = canvasEdges.filter((edge) => childIds.has(edge.source) && childIds.has(edge.target));
  useEffect(() => { if (assetId) void window.desktop.listChildren(assetId).then(setChildren); else setChildren([]); }, [assetId]);
  const childLayoutKey = canvasChildren.map((child) => child.id).sort().join(':');
  useEffect(() => {
    if (!canvasChildren.length) return;
    const ordered = [...canvasChildren].sort((a, b) => a.data.title.localeCompare(b.data.title, 'zh-CN', { numeric: true }));
    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(ordered.length))));
    const cellWidth = Math.max(210, ...ordered.map((child) => nodeSize(child, 'width') + 72));
    const cellHeight = Math.max(180, ...ordered.map((child) => nodeSize(child, 'height') + 72));
    const positions = Object.fromEntries(ordered.map((child, index) => [child.id, { x: 70 + (index % columns) * cellWidth, y: 150 + Math.floor(index / columns) * cellHeight }]));
    const needsLayout = ordered.some((child) => Math.abs(child.position.x - positions[child.id].x) > 2 || Math.abs(child.position.y - positions[child.id].y) > 2);
    if (needsLayout) repositionNodes(positions);
  // Only reflow when folder membership changes; manual movement inside the folder remains possible afterwards.
  }, [childLayoutKey, nodeId]);
  const openCanvasChild = (child: CanvasNode) => {
    if (child.data.documentType) { window.dispatchEvent(new CustomEvent('open-canvas-document', { detail: { nodeId: child.id } })); return; }
    const asset = child.data.assetId ? assets.find((item) => item.id === child.data.assetId) : undefined;
    if (child.data.kind === 'folder') { window.dispatchEvent(new CustomEvent('open-folder-canvas', { detail: { assetId: asset?.id, nodeId: child.id } })); return; }
    if (asset && /^\.(mp4|mov|m4v|webm|mpeg|mpg|avi|mkv)$/i.test(asset.extension)) { window.dispatchEvent(new CustomEvent('open-canvas-video', { detail: { assetId: asset.id } })); return; }
    if (asset?.path) void window.desktop.openAsset(asset.path);
  };
  const createInnerAI = () => { if (!nodeId) return; const id = addNode({ kind: 'ai', title: '深度 AI 分析', subtitle: 'AI 分析', body: '连接文件后，在节点内提问或使用连线中点的 AI 功能。' }, { x: 480, y: 180 }); attachNodesToFolder(nodeId, [id]); };
  const createInnerNode = (data: CanvasNodeData) => { if (!nodeId) return; const id = addNode(data, { x: 260, y: 220 }); attachNodesToFolder(nodeId, [id]); setInnerMenu(null); };
  const createInnerDocument = (type: 'txt' | 'word') => createInnerNode({ kind: 'file', title: type === 'txt' ? '未命名文本.txt' : '未命名文档.docx', subtitle: type === 'txt' ? 'TXT 文档' : 'Word 文档', documentType: type, documentContent: '', body: '', status: 'ready' });
  const selectedIds = canvasChildren.filter((child) => child.selected).map((child) => child.id);
  const moveSelectedOut = () => { if (!nodeId) return; for (const id of selectedIds) detachNodeFromFolder(nodeId, id); };
  const moveCanvasChildOut = (id: string) => { if (!nodeId) return; detachNodeFromFolder(nodeId, id); notify('已移出文件夹并放回主画布'); };
  const moveNativeOut = (items: Asset[]) => {
    if (!items.length) return;
    useCanvasStore.getState().addAssetNodes(items, { x: 220, y: 220 });
    notify(`已将 ${items.length} 项文件放到主画布`);
  };
  const currentInnerSelection = () => {
    const allowed = new Set((useCanvasStore.getState().nodes.find((item) => item.id === nodeId)?.data.childNodeIds || []));
    return useCanvasStore.getState().nodes.filter((item) => allowed.has(item.id) && item.selected).map((item) => item.id);
  };
  const deleteInnerSelection = () => { const ids = currentInnerSelection(); if (ids.length) { removeNodes(ids); notify(`已删除 ${ids.length} 个文件夹项目`); } setInnerMenu(null); };
  const copyInnerSelection = () => { onCopy(); setInnerMenu(null); };
  const commitInnerRename = () => {
    if (!renameTarget) return;
    const title = renameTarget.title.trim();
    if (title) { updateNode(renameTarget.id, { title }); notify(`已重命名为“${title}”`); }
    setRenameTarget(null);
  };
  const total = children.length + canvasChildren.length;
  return <div className="modal-layer" onClick={() => setInnerMenu(null)}><section className="folder-modal folder-flow-modal" onClick={(event) => event.stopPropagation()}><header><div><span><Folder size={17}/></span><div><strong>{node?.data.title || '文件夹画布'}</strong><small>{total} 个直属资料 · 子画布支持节点连线与 AI 工作流</small></div></div><button onClick={onClose}><X size={16}/></button></header><nav><button onClick={onImport}><FilePlus2 size={13}/>添加资料</button><button onClick={createInnerAI}><Bot size={13}/>新建 AI 分析</button><button disabled={!selectedIds.length} onClick={copyInnerSelection}><Copy size={13}/>复制所选</button><button disabled={!canPaste} onClick={onPaste}><ClipboardPaste size={13}/>粘贴到文件夹</button><button disabled={!selectedIds.length} onClick={moveSelectedOut}>移出文件夹到主画布</button>{children.length > 0 && <button onClick={() => moveNativeOut(children)}>全部放到主画布</button>}<button className="danger" disabled={!selectedIds.length} onClick={() => removeNodes(selectedIds)}><Trash2 size={13}/>删除所选</button><span/><button disabled={!assetId} onClick={() => assetId && void window.desktop.openAsset(assets.find((asset) => asset.id === assetId)?.path || '')}><ExternalLink size={13}/>系统中打开</button></nav><div className="folder-inner-flow">{children.length > 0 && <div className="folder-native-strip">{children.map((asset) => <div className="folder-native-item" key={asset.id}><button onDoubleClick={() => void window.desktop.openAsset(asset.path)}><CanvasFilePreview asset={asset}/><span>{asset.name}</span></button><button className="move-out" onClick={() => moveNativeOut([asset])} title="放到主画布">移出</button></div>)}</div>}<ReactFlowProvider><ReactFlow nodes={innerNodes} edges={innerEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onNodeDragStart={() => useCanvasStore.getState().checkpoint()} onNodeDoubleClick={(_event, child) => openCanvasChild(child)} onNodeContextMenu={(event, child) => { event.preventDefault(); event.stopPropagation(); if (!child.selected) selectNodes([child.id]); setInnerMenu({ x: event.clientX, y: event.clientY, kind: 'node', nodeId: child.id }); }} onEdgeClick={(_event, edge) => selectEdge(edge.id)} onEdgeContextMenu={(event, edge) => { event.preventDefault(); event.stopPropagation(); selectEdge(edge.id); setInnerMenu({ x: event.clientX, y: event.clientY, kind: 'edge', edgeId: edge.id }); }} onPaneContextMenu={(event) => { event.preventDefault(); setInnerMenu({ x: event.clientX, y: event.clientY, kind: 'canvas' }); }} nodeTypes={nodeTypes} edgeTypes={edgeTypes} selectionMode={SelectionMode.Partial} selectionOnDrag={interactionMode === 'select'} selectionKeyCode="Shift" panOnDrag={interactionMode === 'pan' ? true : [1, 2]} nodesDraggable connectionMode={ConnectionMode.Loose} isValidConnection={(connection) => connection.source !== connection.target} minZoom={0.25} maxZoom={2} fitView deleteKeyCode={null}><Background variant={BackgroundVariant.Dots} gap={22} size={1}/><Controls position="bottom-left"/><MiniMap position="bottom-right" pannable zoomable nodeColor={(innerNode) => miniColor((innerNode.data as CanvasNodeData).kind)}/></ReactFlow></ReactFlowProvider>{!canvasChildren.length && <div className="folder-empty folder-flow-empty"><FolderPlus size={26}/><strong>这个子画布还是空的</strong><span>关闭后把主画布文件拖到文件夹上，或新建一个 AI 分析节点</span><button onClick={createInnerAI}>新建 AI 分析</button></div>}</div></section>{innerMenu && <div className="context-menu folder-context-menu" style={{ left: innerMenu.x, top: innerMenu.y }} onClick={(event) => event.stopPropagation()}>{innerMenu.kind === 'edge' ? <><div className="context-menu-title">连接线操作</div><button className="danger" onClick={() => { if (innerMenu.edgeId) removeEdges([innerMenu.edgeId]); setInnerMenu(null); notify('连接线已删除，文件保持不变'); }}><Trash2 size={14}/>仅删除连接线</button></> : innerMenu.kind === 'node' ? <><div className="context-menu-title">文件操作 · {currentInnerSelection().length || 1} 项</div><button onClick={() => { const child = canvasChildren.find((item) => item.id === innerMenu.nodeId); if (child) openCanvasChild(child); setInnerMenu(null); }}><ExternalLink size={14}/>打开</button><button onClick={() => { const child = canvasChildren.find((item) => item.id === innerMenu.nodeId); if (child) setRenameTarget({ id: child.id, title: child.data.title }); setInnerMenu(null); }}><Pencil size={14}/>重命名</button><button onClick={copyInnerSelection}><Copy size={14}/>复制 <kbd>⌘C</kbd></button><button disabled={!canPaste} onClick={() => { onPaste(); setInnerMenu(null); }}><ClipboardPaste size={14}/>粘贴到文件夹 <kbd>⌘V</kbd></button><button onClick={() => { moveSelectedOut(); setInnerMenu(null); }}><ExternalLink size={14}/>移出到主画布</button><hr/><button className="danger" onClick={deleteInnerSelection}><Trash2 size={14}/>删除所选</button></> : <><button disabled={!canPaste} onClick={() => { onPaste(); setInnerMenu(null); }}><ClipboardPaste size={14}/>粘贴到文件夹 <kbd>⌘V</kbd></button><button onClick={() => { createInnerAI(); setInnerMenu(null); }}><Bot size={14}/>新建 AI 分析</button><hr/><button onClick={() => createInnerDocument('txt')}><FileText size={14}/>新建 TXT 文档</button><button onClick={() => createInnerDocument('word')}><FilePlus2 size={14}/>新建 Word 文档</button><button onClick={() => createInnerNode({ kind: 'folder', title: '新建画布文件夹', subtitle: '画布文件夹 · 0 个项目', childNodeIds: [] })}><FolderPlus size={14}/>新建画布文件夹</button><button onClick={() => createInnerNode({ kind: 'knowledge-base', title: '新建知识库', subtitle: '知识库 · 0 份资料', childNodeIds: [] })}><Database size={14}/>新建知识库</button></>}</div>}{renameTarget && <div className="folder-rename-layer" onClick={() => setRenameTarget(null)}><form onSubmit={(event) => { event.preventDefault(); commitInnerRename(); }} onClick={(event) => event.stopPropagation()}><strong>重命名文件夹项目</strong><input autoFocus value={renameTarget.title} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setRenameTarget({ ...renameTarget, title: event.target.value })}/><footer><button type="button" onClick={() => setRenameTarget(null)}>取消</button><button className="primary" type="submit">保存</button></footer></form></div>}</div>;
}

function CanvasFilePreview({ asset, fallbackKind = 'file' }: { asset?: Asset; fallbackKind?: CanvasNodeData['kind'] }) {
  const [preview, setPreview] = useState('');
  useEffect(() => { let active = true; if (!asset?.path) { setPreview(''); return; } void window.desktop.getFileIcon(asset.path).then((value) => { if (active) setPreview(value); }).catch(() => { if (active) setPreview(''); }); return () => { active = false; }; }, [asset?.path]);
  return <span className={`folder-file-icon ${asset?.kind || fallbackKind} ${preview ? 'preview' : ''}`}>{preview ? <img src={preview} alt=""/> : (asset?.kind || fallbackKind) === 'folder' ? <Folder size={26}/> : <FileText size={26}/>}</span>;
}
