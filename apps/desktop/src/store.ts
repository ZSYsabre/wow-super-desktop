import { applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type XYPosition } from '@xyflow/react';
import { create } from 'zustand';
import type { Asset, CanvasEdge, CanvasEdgeData, CanvasEdgeKind, CanvasNode, CanvasNodeData, WorkspaceState } from './types';

type Snapshot = { nodes: CanvasNode[]; edges: CanvasEdge[] };

interface CanvasStore extends WorkspaceState {
  hydrated: boolean; selectedId?: string; locatedId?: string; undoStack: Snapshot[]; interactionMode: 'select' | 'pan';
  hydrate(workspace: WorkspaceState | null, assets: Asset[]): void;
  replaceCanvas(nodes: CanvasNode[], edges: CanvasEdge[]): void;
  onNodesChange(changes: NodeChange<CanvasNode>[]): void;
  onEdgesChange(changes: EdgeChange<CanvasEdge>[]): void;
  connect(connection: Connection): void;
  connectResult(originEdgeId: string, resultNodeId: string): void;
  connectFromEdge(originEdgeId: string, targetNodeId: string): void;
  setSelected(id?: string): void;
  selectNodes(ids: string[]): void;
  selectEdge(id: string): void;
  setLocated(id?: string): void;
  setInteractionMode(mode: 'select' | 'pan'): void;
  addNode(data: CanvasNodeData, position?: XYPosition): string;
  addAssetNodes(roots: Asset[], position?: XYPosition): void;
  updateNode(id: string, patch: Partial<CanvasNodeData>): void;
  updateEdge(id: string, patch: Partial<CanvasEdgeData>): void;
  removeNodes(ids: string[]): void;
  removeEdges(ids: string[]): void;
  removeItems(nodeIds: string[], edgeIds: string[]): void;
  setAssets(assets: Asset[]): void;
  updateAsset(asset: Asset): void;
  checkpoint(): void;
  insertNodes(nodes: CanvasNode[], edges: CanvasEdge[]): void;
  repositionNodes(positions: Record<string, XYPosition>): void;
  resizeNodes(layout: Record<string, { position: XYPosition; width: number; height: number }>): void;
  attachNodesToKnowledge(knowledgeId: string, nodeIds: string[]): void;
  detachNodeFromKnowledge(knowledgeId: string, nodeId: string): void;
  attachNodesToFolder(folderId: string, nodeIds: string[]): void;
  detachNodeFromFolder(folderId: string, nodeId: string): void;
  undo(): void;
}

const initialNodes: CanvasNode[] = [
  { id: 'demo-folder-a', type: 'knowledgeNode', position: { x: 80, y: 130 }, data: { kind: 'folder', title: '用户访谈', subtitle: '拖入真实文件夹开始', status: 'virtual' } },
  { id: 'demo-folder-b', type: 'knowledgeNode', position: { x: 80, y: 390 }, data: { kind: 'folder', title: '竞品资料', subtitle: '拖入真实文件夹开始', status: 'virtual' } },
  { id: 'demo-kb', type: 'knowledgeNode', position: { x: 390, y: 250 }, data: { kind: 'knowledge-base', title: '新产品调研', subtitle: '知识库 · 2 个来源' } },
  { id: 'demo-ai', type: 'knowledgeNode', position: { x: 720, y: 220 }, data: { kind: 'ai', title: '产品机会分析', subtitle: 'AI 分析', body: '连接真实资料后，在节点内或底部提问。' } },
  { id: 'demo-answer', type: 'knowledgeNode', position: { x: 1060, y: 120 }, data: { kind: 'answer', title: '核心结论', subtitle: '结论 · 可追溯引用', body: 'AI 回答可以保存到这里。' } },
];

const initialEdges: CanvasEdge[] = [
  edge('e-a-kb', 'demo-folder-a', 'demo-kb', 'relation'), edge('e-b-kb', 'demo-folder-b', 'demo-kb', 'relation'),
  edge('e-kb-ai', 'demo-kb', 'demo-ai', 'ai-context'), edge('e-ai-answer', 'demo-ai', 'demo-answer', 'workflow'),
];

function edge(id: string, source: string, target: string, kind: CanvasEdgeKind): CanvasEdge {
  return { id, source, target, type: 'knowledgeEdge', data: { kind }, label: kind === 'ai-context' ? '提供给 AI' : kind === 'workflow' ? '生成' : undefined };
}

function snapshot(state: CanvasStore): Snapshot { return { nodes: structuredClone(state.nodes), edges: structuredClone(state.edges) }; }
function pushUndo(state: CanvasStore) { return [...state.undoStack.slice(-79), snapshot(state)]; }
function compactAssetNode(node: CanvasNode): CanvasNode {
  if (!['file', 'folder'].includes(node.data.kind)) return node;
  if (node.width && node.height && (node.width !== 112 || node.height !== 112)) {
    return { ...node, style: { ...node.style, width: node.width, height: node.height } };
  }
  return { ...node, width: undefined, height: undefined, style: { ...node.style, width: 112, height: 112 } };
}

function normalizeNode(node: CanvasNode): CanvasNode {
  const compact = compactAssetNode(node);
  if (compact.data.kind === 'answer' && !compact.width && !compact.style?.width) {
    return { ...compact, measured: undefined, style: { ...compact.style, width: 360, height: 240 } };
  }
  return compact;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: initialNodes, edges: initialEdges, assets: [], revision: 1, hydrated: false, undoStack: [], selectedId: 'demo-ai', locatedId: undefined, interactionMode: 'pan',
  hydrate: (workspace, assets) => {
    const source = workspace || { nodes: initialNodes, edges: initialEdges, revision: 1 };
    const nodes = source.nodes.filter((node) => node.data.kind !== 'note' && node.data.kind !== 'task').map(normalizeNode);
    const ids = new Set(nodes.map((node) => node.id));
    return set({ ...source, nodes, edges: source.edges.filter((item) => ids.has(item.source) && ids.has(item.target)), assets, hydrated: true, interactionMode: 'pan' });
  },
  replaceCanvas: (nodes, edges) => set({
    nodes: nodes.map(normalizeNode), edges: structuredClone(edges), selectedId: undefined,
    locatedId: undefined, undoStack: [], interactionMode: 'pan', revision: get().revision + 1,
  }),
  onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes), revision: state.revision + 1 })),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges), revision: state.revision + 1 })),
  connect: (connection) => set((state) => {
    const target = state.nodes.find((node) => node.id === connection.target);
    const kind: CanvasEdgeKind = target?.data.kind === 'ai' ? 'ai-context' : 'relation';
    const nextEdge: CanvasEdge = { ...connection, id: crypto.randomUUID(), type: 'knowledgeEdge', data: { kind }, label: kind === 'ai-context' ? '提供给 AI' : undefined };
    return { undoStack: pushUndo(state), edges: [...state.edges, nextEdge], revision: state.revision + 1 };
  }),
  connectResult: (originEdgeId, resultNodeId) => set((state) => {
    const origin = state.edges.find((item) => item.id === originEdgeId);
    if (!origin || !state.nodes.some((node) => node.id === resultNodeId)) return state;
    const resultEdge: CanvasEdge = {
      id: crypto.randomUUID(), source: origin.source, target: resultNodeId,
      type: 'knowledgeEdge', label: 'AI 分析结果',
      data: { kind: 'workflow', originEdgeId, resultLink: true },
    };
    return { undoStack: pushUndo(state), edges: [...state.edges, resultEdge], revision: state.revision + 1 };
  }),
  connectFromEdge: (originEdgeId, targetNodeId) => set((state) => {
    const origin = state.edges.find((item) => item.id === originEdgeId);
    if (!origin || [origin.source, origin.target].includes(targetNodeId) || !state.nodes.some((node) => node.id === targetNodeId)) return state;
    const branchEdge: CanvasEdge = {
      id: crypto.randomUUID(), source: origin.source, target: targetNodeId,
      type: 'knowledgeEdge', label: '连接点延伸',
      data: { kind: 'relation', originEdgeId, resultLink: true },
    };
    return { undoStack: pushUndo(state), edges: [...state.edges, branchEdge], revision: state.revision + 1 };
  }),
  setSelected: (selectedId) => set((state) => ({ selectedId, nodes: selectedId ? state.nodes : state.nodes.map((node) => ({ ...node, selected: false })), edges: state.edges.map((edge) => ({ ...edge, selected: false })) })),
  selectNodes: (ids) => set((state) => {
    const selected = new Set(ids);
    return { nodes: state.nodes.map((node) => ({ ...node, selected: selected.has(node.id) })), edges: state.edges.map((edge) => ({ ...edge, selected: false })), selectedId: ids.at(-1) };
  }),
  selectEdge: (id) => set((state) => ({ nodes: state.nodes.map((node) => ({ ...node, selected: false })), edges: state.edges.map((edge) => ({ ...edge, selected: edge.id === id })), selectedId: undefined })),
  setLocated: (locatedId) => set({ locatedId }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  addNode: (data, position = { x: 420, y: 220 }) => {
    const id = crypto.randomUUID();
    const style = data.kind === 'answer' ? { width: 360, height: 240 } : undefined;
    set((state) => ({ undoStack: pushUndo(state), nodes: [...state.nodes, { id, type: 'knowledgeNode', position, data, style }], selectedId: id, revision: state.revision + 1 }));
    return id;
  },
  addAssetNodes: (roots, position = { x: 180, y: 180 }) => set((state) => {
    const additions = roots.filter((asset) => !state.nodes.some((node) => node.data.assetId === asset.id)).map((asset, index) => ({
      id: crypto.randomUUID(), type: 'knowledgeNode', position: { x: position.x + (index % 4) * 160, y: position.y + Math.floor(index / 4) * 145 },
      style: { width: 112, height: 112 }, data: { kind: asset.kind, title: asset.name, subtitle: asset.kind === 'folder' ? '本地文件夹' : asset.extension.slice(1).toUpperCase(), assetId: asset.id, status: asset.indexStatus },
    } as CanvasNode));
    return { nodes: [...state.nodes, ...additions], undoStack: additions.length ? pushUndo(state) : state.undoStack, revision: state.revision + (additions.length ? 1 : 0) };
  }),
  updateNode: (id, patch) => set((state) => ({ undoStack: pushUndo(state), nodes: state.nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node), revision: state.revision + 1 })),
  updateEdge: (id, patch) => set((state) => ({ undoStack: pushUndo(state), edges: state.edges.map((edge) => edge.id === id ? { ...edge, data: { kind: edge.data?.kind || 'relation', ...edge.data, ...patch } } : edge), revision: state.revision + 1 })),
  removeNodes: (ids) => set((state) => {
    const released = new Set(state.nodes.filter((node) => ids.includes(node.id)).flatMap((node) => node.data.childNodeIds || []));
    return { undoStack: pushUndo(state), nodes: state.nodes.filter((node) => !ids.includes(node.id)).map((node) => released.has(node.id) ? { ...node, hidden: false } : node), edges: state.edges.filter((item) => !ids.includes(item.source) && !ids.includes(item.target)), selectedId: undefined, revision: state.revision + 1 };
  }),
  removeEdges: (ids) => set((state) => ({ undoStack: pushUndo(state), edges: state.edges.filter((edge) => !ids.includes(edge.id) && !ids.includes(edge.data?.originEdgeId || '')), revision: state.revision + 1 })),
  removeItems: (nodeIds, edgeIds) => set((state) => {
    if (!nodeIds.length && !edgeIds.length) return state;
    const released = new Set(state.nodes.filter((node) => nodeIds.includes(node.id)).flatMap((node) => node.data.childNodeIds || []));
    return {
      undoStack: pushUndo(state),
      nodes: state.nodes.filter((node) => !nodeIds.includes(node.id)).map((node) => released.has(node.id) ? { ...node, hidden: false, selected: false } : node),
      edges: state.edges.filter((edge) => !edgeIds.includes(edge.id) && !edgeIds.includes(edge.data?.originEdgeId || '') && !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)),
      selectedId: undefined,
      revision: state.revision + 1,
    };
  }),
  setAssets: (assets) => set({ assets }),
  updateAsset: (asset) => set((state) => ({ assets: [...state.assets.filter((item) => item.id !== asset.id), asset], nodes: state.nodes.map((node) => node.data.assetId === asset.id ? { ...node, data: { ...node.data, title: asset.name, status: asset.indexStatus } } : node) })),
  checkpoint: () => set((state) => ({ undoStack: pushUndo(state) })),
  insertNodes: (nodes, edges) => set((state) => ({
    undoStack: pushUndo(state),
    nodes: [...state.nodes.map((node) => ({ ...node, selected: false })), ...nodes],
    edges: [...state.edges.map((edge) => ({ ...edge, selected: false })), ...edges],
    selectedId: nodes.at(-1)?.id,
    revision: state.revision + 1,
  })),
  repositionNodes: (positions) => set((state) => {
    if (!Object.keys(positions).length) return state;
    return {
      undoStack: pushUndo(state),
      nodes: state.nodes.map((node) => positions[node.id] ? { ...node, position: positions[node.id] } : node),
      revision: state.revision + 1,
    };
  }),
  resizeNodes: (layout) => set((state) => {
    if (!Object.keys(layout).length) return state;
    return {
      nodes: state.nodes.map((node) => {
        const next = layout[node.id];
        if (!next) return node;
        return {
          ...node,
          position: next.position,
          width: next.width,
          height: next.height,
          measured: { width: next.width, height: next.height },
          style: { ...node.style, width: next.width, height: next.height },
        };
      }),
      revision: state.revision + 1,
    };
  }),
  attachNodesToKnowledge: (knowledgeId, nodeIds) => set((state) => {
    const knowledge = state.nodes.find((node) => node.id === knowledgeId && node.data.kind === 'knowledge-base');
    if (!knowledge) return state;
    const accepted = nodeIds.filter((id) => id !== knowledgeId && state.nodes.some((node) => node.id === id && ['file', 'folder'].includes(node.data.kind)));
    if (!accepted.length) return state;
    const childNodeIds = [...new Set([...(knowledge.data.childNodeIds || []), ...accepted])];
    return {
      undoStack: pushUndo(state),
      nodes: state.nodes.map((node) => node.id === knowledgeId ? { ...node, data: { ...node.data, childNodeIds, subtitle: `知识库 · ${childNodeIds.length} 份资料` } } : accepted.includes(node.id) ? { ...node, hidden: true, selected: false } : node),
      edges: [...state.edges, ...accepted.filter((nodeId) => !state.edges.some((edge) => edge.source === nodeId && edge.target === knowledgeId)).map((nodeId) => ({ id: crypto.randomUUID(), source: nodeId, target: knowledgeId, type: 'knowledgeEdge', data: { kind: 'relation' as CanvasEdgeKind } }))],
      selectedId: knowledgeId, revision: state.revision + 1,
    };
  }),
  detachNodeFromKnowledge: (knowledgeId, nodeId) => set((state) => {
    const knowledge = state.nodes.find((node) => node.id === knowledgeId);
    if (!knowledge) return state;
    const childNodeIds = (knowledge.data.childNodeIds || []).filter((id) => id !== nodeId);
    return {
      undoStack: pushUndo(state),
      nodes: state.nodes.map((node) => node.id === knowledgeId ? { ...node, data: { ...node.data, childNodeIds, subtitle: `知识库 · ${childNodeIds.length} 份资料` } } : node.id === nodeId ? { ...node, hidden: false, position: { x: knowledge.position.x + 40, y: knowledge.position.y + (Number(knowledge.measured?.height) || 220) + 60 } } : node),
      edges: state.edges.filter((edge) => !(edge.source === nodeId && edge.target === knowledgeId && edge.data?.kind === 'relation')),
      revision: state.revision + 1,
    };
  }),
  attachNodesToFolder: (folderId, nodeIds) => set((state) => {
    const folder = state.nodes.find((node) => node.id === folderId && node.data.kind === 'folder');
    if (!folder) return state;
    const accepted = nodeIds.filter((id) => id !== folderId && state.nodes.some((node) => node.id === id));
    if (!accepted.length) return state;
    const childNodeIds = [...new Set([...(folder.data.childNodeIds || []), ...accepted])];
    return {
      undoStack: pushUndo(state),
      nodes: state.nodes.map((node) => node.id === folderId ? { ...node, data: { ...node.data, childNodeIds, subtitle: `画布文件夹 · ${childNodeIds.length} 个项目` } } : accepted.includes(node.id) ? { ...node, hidden: true, selected: false } : node),
      edges: [...state.edges, ...accepted.filter((nodeId) => !state.edges.some((edge) => edge.source === nodeId && edge.target === folderId)).map((nodeId) => ({ id: crypto.randomUUID(), source: nodeId, target: folderId, type: 'knowledgeEdge', data: { kind: 'relation' as CanvasEdgeKind } }))],
      selectedId: folderId, revision: state.revision + 1,
    };
  }),
  detachNodeFromFolder: (folderId, nodeId) => set((state) => {
    const folder = state.nodes.find((node) => node.id === folderId);
    if (!folder) return state;
    const childNodeIds = (folder.data.childNodeIds || []).filter((id) => id !== nodeId);
    return {
      undoStack: pushUndo(state),
      nodes: state.nodes.map((node) => node.id === folderId ? { ...node, data: { ...node.data, childNodeIds, subtitle: `画布文件夹 · ${childNodeIds.length} 个项目` } } : node.id === nodeId ? { ...node, hidden: false, position: { x: folder.position.x + 30, y: folder.position.y + 155 } } : node),
      edges: state.edges.filter((edge) => !(edge.source === nodeId && edge.target === folderId && edge.data?.kind === 'relation')),
      revision: state.revision + 1,
    };
  }),
  undo: () => set((state) => {
    const previous = state.undoStack.at(-1); if (!previous) return state;
    return { nodes: previous.nodes, edges: previous.edges, undoStack: state.undoStack.slice(0, -1), revision: state.revision + 1 };
  }),
}));

export function collectScope(nodeId: string | undefined, nodes: CanvasNode[], edges: CanvasEdge[]): string[] {
  if (!nodeId) return nodes.map((node) => node.data.assetId).filter(Boolean) as string[];
  const visited = new Set<string>(); const queue = [nodeId]; const assets = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!; if (visited.has(current)) continue; visited.add(current);
    const node = nodes.find((item) => item.id === current); if (node?.data.assetId) assets.add(node.data.assetId);
    for (const item of edges) if (item.target === current) { const source = nodes.find((nodeItem) => nodeItem.id === item.source); if (source?.data.kind !== 'ai') queue.push(item.source); }
  }
  return [...assets];
}

export function collectEdgeNetwork(edgeId: string, nodes: CanvasNode[], edges: CanvasEdge[]): string[] {
  const origin = edges.find((item) => item.id === edgeId);
  if (!origin) return [];
  const allowedKinds = new Set(['file', 'folder']);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const queue = [origin.source, origin.target];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    const node = nodeById.get(current);
    if (!node || !allowedKinds.has(node.data.kind)) continue;
    visited.add(current);
    for (const item of edges) {
      if (item.data?.resultLink || !['relation', 'visual'].includes(item.data?.kind || 'relation')) continue;
      if (item.source === current && !visited.has(item.target)) queue.push(item.target);
      if (item.target === current && !visited.has(item.source)) queue.push(item.source);
    }
  }
  return [...visited];
}
