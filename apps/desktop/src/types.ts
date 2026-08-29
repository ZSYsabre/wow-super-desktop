import type { Edge, Node } from '@xyflow/react';

export type AssetKind = 'file' | 'folder';
export type IndexStatus = 'pending' | 'scanning' | 'processing' | 'ready' | 'failed' | 'unsupported';
export type CanvasNodeKind = 'file' | 'folder' | 'knowledge-base' | 'ai' | 'answer' | 'task' | 'note';
export type CanvasEdgeKind = 'visual' | 'relation' | 'ai-context' | 'workflow';

export interface Asset {
  id: string; parentId?: string; path: string; name: string; kind: AssetKind;
  extension: string; size: number; modifiedAt: number; indexStatus: IndexStatus;
  childCount?: number; error?: string;
}

export interface Citation {
  chunkId: string; assetId: string; source: string; sourcePath: string;
  locator: string; page?: number; text: string; score: number;
}

export interface CanvasNodeData extends Record<string, unknown> {
  kind: CanvasNodeKind; title: string; subtitle?: string; assetId?: string;
  body?: string; instructions?: string; citations?: Citation[]; status?: string;
  progress?: number; childNodeIds?: string[]; collapsed?: boolean;
  documentType?: 'txt' | 'word'; documentContent?: string;
}

export type CanvasNode = Node<CanvasNodeData>;
export type EdgeAIAction = 'ai-analysis' | 'image-generation' | 'video-generation';
export interface CanvasEdgeData extends Record<string, unknown> {
  kind: CanvasEdgeKind; action?: EdgeAIAction; instructions?: string;
  provider?: string; baseUrl?: string; model?: string;
  originEdgeId?: string; resultLink?: boolean;
}
export type CanvasEdge = Edge<CanvasEdgeData>;

export interface CanvasPage {
  id: string; title: string; nodes: CanvasNode[]; edges: CanvasEdge[];
}

export interface AISettings {
  provider: string; baseUrl: string; model: string; instructions: string;
  quickInstructions: string;
  configured: boolean; keyHint: string; encryptionAvailable: boolean; usingEnvironmentKey: boolean;
}

export interface WorkspaceState {
  nodes: CanvasNode[]; edges: CanvasEdge[]; assets: Asset[]; revision: number;
  canvases?: CanvasPage[]; activeCanvasId?: string;
}

export interface ProgressEvent {
  type: 'asset' | 'folder-progress'; asset?: Asset; assetId?: string; completed?: number; total?: number;
}

export interface AIAttachment {
  name: string; path: string; kind: AssetKind; extension: string; assetId?: string;
}
