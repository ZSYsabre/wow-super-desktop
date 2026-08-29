import { describe, expect, it } from 'vitest';
import { collectEdgeNetwork, collectScope, useCanvasStore } from './store';
import type { CanvasEdge, CanvasNode } from './types';

describe('collectScope', () => {
  it('collects upstream assets and stops at AI nodes', () => {
    const nodes = [
      { id: 'asset', position: { x: 0, y: 0 }, data: { kind: 'file', title: '资料', assetId: 'asset-1' } },
      { id: 'kb', position: { x: 0, y: 0 }, data: { kind: 'knowledge-base', title: '知识库' } },
      { id: 'ai', position: { x: 0, y: 0 }, data: { kind: 'ai', title: '分析' } },
    ] as CanvasNode[];
    const edges = [
      { id: 'a', source: 'asset', target: 'kb', data: { kind: 'relation' } },
      { id: 'b', source: 'kb', target: 'ai', data: { kind: 'ai-context' } },
    ] as CanvasEdge[];
    expect(collectScope('ai', nodes, edges)).toEqual(['asset-1']);
  });

  it('collects three or more files from the whole connected edge network', () => {
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 }, data: { kind: 'file', title: 'A' } },
      { id: 'b', position: { x: 100, y: 0 }, data: { kind: 'file', title: 'B' } },
      { id: 'c', position: { x: 200, y: 0 }, data: { kind: 'file', title: 'C' } },
      { id: 'd', position: { x: 300, y: 0 }, data: { kind: 'file', title: 'D' } },
      { id: 'answer', position: { x: 100, y: 200 }, data: { kind: 'answer', title: '旧分析' } },
    ] as CanvasNode[];
    const edges = [
      { id: 'ab', source: 'a', target: 'b', data: { kind: 'relation' } },
      { id: 'bc', source: 'b', target: 'c', data: { kind: 'relation' } },
      { id: 'cd', source: 'c', target: 'd', data: { kind: 'relation' } },
      { id: 'result', source: 'a', target: 'answer', data: { kind: 'workflow', resultLink: true, originEdgeId: 'ab' } },
    ] as CanvasEdge[];
    expect(collectEdgeNetwork('bc', nodes, edges)).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('canvas connections', () => {
  it('always hydrates into pan mode until the user explicitly selects marquee mode', () => {
    useCanvasStore.getState().setInteractionMode('select');
    useCanvasStore.getState().hydrate({ nodes: [], edges: [], assets: [], revision: 1 }, []);
    expect(useCanvasStore.getState().interactionMode).toBe('pan');
  });

  it('preserves a user-resized desktop file node during hydration', () => {
    const node = { id: 'file', type: 'knowledgeNode', position: { x: 0, y: 0 }, width: 260, height: 260, data: { kind: 'file', title: '图片.png' } } as CanvasNode;
    useCanvasStore.getState().hydrate({ nodes: [node], edges: [], assets: [], revision: 1 }, []);
    const restored = useCanvasStore.getState().nodes[0];
    expect(restored.width).toBe(260);
    expect(restored.height).toBe(260);
    expect(restored.style).toMatchObject({ width: 260, height: 260 });
  });

  it('resizes a marquee selection as one group and restores it with undo', () => {
    const nodes = [
      { id: 'a', type: 'knowledgeNode', position: { x: 10, y: 20 }, width: 100, height: 100, selected: true, data: { kind: 'file', title: 'A' } },
      { id: 'b', type: 'knowledgeNode', position: { x: 210, y: 120 }, width: 120, height: 120, selected: true, data: { kind: 'file', title: 'B' } },
    ] as CanvasNode[];
    useCanvasStore.getState().hydrate({ nodes, edges: [], assets: [], revision: 1 }, []);
    useCanvasStore.getState().checkpoint();
    useCanvasStore.getState().resizeNodes({
      a: { position: { x: 20, y: 40 }, width: 200, height: 200 },
      b: { position: { x: 420, y: 240 }, width: 240, height: 240 },
    });
    expect(useCanvasStore.getState().nodes.map(({ position, width, height }) => ({ position, width, height }))).toEqual([
      { position: { x: 20, y: 40 }, width: 200, height: 200 },
      { position: { x: 420, y: 240 }, width: 240, height: 240 },
    ]);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes.map(({ position, width, height }) => ({ position, width, height }))).toEqual([
      { position: { x: 10, y: 20 }, width: 100, height: 100 },
      { position: { x: 210, y: 120 }, width: 120, height: 120 },
    ]);
  });

  it('allows repeated parallel edges and removes edges without removing nodes', () => {
    const nodes = [
      { id: 'source', type: 'knowledgeNode', position: { x: 0, y: 0 }, data: { kind: 'file', title: 'A' } },
      { id: 'target', type: 'knowledgeNode', position: { x: 200, y: 0 }, data: { kind: 'file', title: 'B' } },
    ] as CanvasNode[];
    const store = useCanvasStore.getState();
    store.hydrate({ nodes, edges: [], assets: [], revision: 1 }, []);
    useCanvasStore.getState().connect({ source: 'source', target: 'target', sourceHandle: 'right', targetHandle: 'left' });
    useCanvasStore.getState().connect({ source: 'source', target: 'target', sourceHandle: 'right', targetHandle: 'left' });
    const edges = useCanvasStore.getState().edges;
    expect(edges).toHaveLength(2);
    useCanvasStore.getState().removeEdges([edges[0].id]);
    expect(useCanvasStore.getState().edges).toHaveLength(1);
    expect(useCanvasStore.getState().nodes.map((node) => node.id)).toEqual(['source', 'target']);
  });

  it('connects an AI result back to the originating file-to-file edge', () => {
    const nodes = [
      { id: 'left', type: 'knowledgeNode', position: { x: 0, y: 0 }, data: { kind: 'file', title: 'A' } },
      { id: 'right', type: 'knowledgeNode', position: { x: 300, y: 0 }, data: { kind: 'file', title: 'B' } },
      { id: 'result', type: 'knowledgeNode', position: { x: 150, y: 200 }, data: { kind: 'answer', title: '连线 AI 分析' } },
    ] as CanvasNode[];
    const edges = [{ id: 'origin', source: 'left', target: 'right', type: 'knowledgeEdge', data: { kind: 'relation' } }] as CanvasEdge[];
    useCanvasStore.getState().hydrate({ nodes, edges, assets: [], revision: 1 }, []);
    useCanvasStore.getState().connectResult('origin', 'result');
    const resultEdge = useCanvasStore.getState().edges.find((edge) => edge.data?.resultLink);
    expect(resultEdge?.target).toBe('result');
    expect(resultEdge?.data?.originEdgeId).toBe('origin');
  });

  it('creates a branch from an edge junction and removes it with its origin edge', () => {
    const nodes = [
      { id: 'left', type: 'knowledgeNode', position: { x: 0, y: 0 }, data: { kind: 'file', title: 'A' } },
      { id: 'right', type: 'knowledgeNode', position: { x: 300, y: 0 }, data: { kind: 'file', title: 'B' } },
      { id: 'other', type: 'knowledgeNode', position: { x: 150, y: 200 }, data: { kind: 'file', title: 'C' } },
    ] as CanvasNode[];
    const edges = [{ id: 'origin', source: 'left', target: 'right', type: 'knowledgeEdge', data: { kind: 'relation' } }] as CanvasEdge[];
    useCanvasStore.getState().hydrate({ nodes, edges, assets: [], revision: 1 }, []);
    useCanvasStore.getState().connectFromEdge('origin', 'other');
    expect(useCanvasStore.getState().edges.find((edge) => edge.data?.originEdgeId === 'origin')?.target).toBe('other');
    useCanvasStore.getState().removeEdges(['origin']);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
  });

  it('stores files inside a knowledge base and restores them when detached', () => {
    const nodes = [
      { id: 'file', type: 'knowledgeNode', position: { x: 0, y: 0 }, data: { kind: 'file', title: '资料.txt', documentType: 'txt' } },
      { id: 'kb', type: 'knowledgeNode', position: { x: 300, y: 0 }, data: { kind: 'knowledge-base', title: '研究知识库' } },
    ] as CanvasNode[];
    useCanvasStore.getState().hydrate({ nodes, edges: [], assets: [], revision: 1 }, []);
    useCanvasStore.getState().attachNodesToKnowledge('kb', ['file']);
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'file')?.hidden).toBe(true);
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'kb')?.data.childNodeIds).toEqual(['file']);
    useCanvasStore.getState().detachNodeFromKnowledge('kb', 'file');
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'file')?.hidden).toBe(false);
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'kb')?.data.childNodeIds).toEqual([]);
  });

  it('moves canvas files into and out of a canvas folder', () => {
    const nodes = [
      { id: 'file', type: 'knowledgeNode', position: { x: 0, y: 0 }, data: { kind: 'file', title: '图片.png' } },
      { id: 'folder', type: 'knowledgeNode', position: { x: 200, y: 0 }, data: { kind: 'folder', title: '新建文件夹' } },
    ] as CanvasNode[];
    useCanvasStore.getState().hydrate({ nodes, edges: [], assets: [], revision: 1 }, []);
    useCanvasStore.getState().attachNodesToFolder('folder', ['file']);
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'file')?.hidden).toBe(true);
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'folder')?.data.childNodeIds).toEqual(['file']);
    useCanvasStore.getState().detachNodeFromFolder('folder', 'file');
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'file')?.hidden).toBe(false);
  });

  it('allows AI and result nodes to live inside a canvas folder', () => {
    const nodes = [
      { id: 'ai', type: 'knowledgeNode', position: { x: 0, y: 0 }, data: { kind: 'ai', title: '深度分析' } },
      { id: 'answer', type: 'knowledgeNode', position: { x: 200, y: 0 }, data: { kind: 'answer', title: '分析结论' } },
      { id: 'folder', type: 'knowledgeNode', position: { x: 400, y: 0 }, data: { kind: 'folder', title: '项目文件夹' } },
    ] as CanvasNode[];
    useCanvasStore.getState().hydrate({ nodes, edges: [], assets: [], revision: 1 }, []);
    useCanvasStore.getState().attachNodesToFolder('folder', ['ai', 'answer']);
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'folder')?.data.childNodeIds).toEqual(['ai', 'answer']);
    expect(useCanvasStore.getState().nodes.filter((node) => ['ai', 'answer'].includes(node.id)).every((node) => node.hidden)).toBe(true);
  });

  it('deletes a generated AI answer without deleting its source document', () => {
    const nodes = [
      { id: 'source', type: 'knowledgeNode', position: { x: 0, y: 0 }, data: { kind: 'file', title: '来源.md' } },
      { id: 'answer', type: 'knowledgeNode', position: { x: 200, y: 0 }, data: { kind: 'answer', title: '连线 AI 分析', body: '分析结果' } },
    ] as CanvasNode[];
    const edges = [{ id: 'result-edge', source: 'source', target: 'answer', type: 'knowledgeEdge', data: { kind: 'workflow' } }] as CanvasEdge[];
    useCanvasStore.getState().hydrate({ nodes, edges, assets: [], revision: 1 }, []);
    useCanvasStore.getState().removeNodes(['answer']);
    expect(useCanvasStore.getState().nodes.map((node) => node.id)).toEqual(['source']);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
  });

  it('releases contained files when deleting their container', () => {
    const nodes = [
      { id: 'file', type: 'knowledgeNode', position: { x: 0, y: 0 }, hidden: true, data: { kind: 'file', title: '资料.pdf' } },
      { id: 'kb', type: 'knowledgeNode', position: { x: 200, y: 0 }, data: { kind: 'knowledge-base', title: '知识库', childNodeIds: ['file'] } },
    ] as CanvasNode[];
    useCanvasStore.getState().hydrate({ nodes, edges: [], assets: [], revision: 1 }, []);
    useCanvasStore.getState().removeNodes(['kb']);
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'file')?.hidden).toBe(false);
  });

  it('deletes all marquee-selected nodes and edges in one operation', () => {
    const nodes = [
      { id: 'a', type: 'knowledgeNode', position: { x: 0, y: 0 }, selected: true, data: { kind: 'file', title: 'A' } },
      { id: 'b', type: 'knowledgeNode', position: { x: 200, y: 0 }, selected: true, data: { kind: 'file', title: 'B' } },
      { id: 'keep', type: 'knowledgeNode', position: { x: 400, y: 0 }, data: { kind: 'file', title: '保留' } },
    ] as CanvasNode[];
    const edges = [
      { id: 'selected-edge', source: 'a', target: 'b', selected: true, type: 'knowledgeEdge', data: { kind: 'relation' } },
      { id: 'keep-edge', source: 'keep', target: 'keep', type: 'knowledgeEdge', data: { kind: 'relation' } },
    ] as CanvasEdge[];
    useCanvasStore.getState().hydrate({ nodes, edges, assets: [], revision: 1 }, []);
    useCanvasStore.getState().removeItems(['a', 'b'], ['selected-edge']);
    expect(useCanvasStore.getState().nodes.map((node) => node.id)).toEqual(['keep']);
    expect(useCanvasStore.getState().edges.map((edge) => edge.id)).toEqual(['keep-edge']);
  });
});
