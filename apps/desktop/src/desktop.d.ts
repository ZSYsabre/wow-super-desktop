import type { AIAttachment, AISettings, Asset, Citation, ProgressEvent, WorkspaceState } from './types';

declare global {
  interface Window {
    desktop: {
      pickAssets(): Promise<string[]>;
      describePaths(paths: string[]): Promise<Array<Pick<Asset, 'path' | 'name' | 'kind' | 'size' | 'modifiedAt' | 'extension'>>>;
      ingestPaths(paths: string[]): Promise<{ roots: Asset[]; assets: Asset[] }>;
      listAssets(): Promise<Asset[]>;
      listChildren(parentId: string): Promise<Asset[]>;
      rescanAsset(assetId: string): Promise<Asset>;
      ensureKnowledgeIndexed(assetIds: string[]): Promise<Asset[]>;
      searchKnowledge(input: { query: string; assetIds?: string[]; ensureCoverage?: boolean }): Promise<Citation[]>;
      readKnowledge(assetIds: string[]): Promise<Citation[]>;
      loadWorkspace(): Promise<WorkspaceState | null>;
      saveWorkspace(workspace: WorkspaceState): Promise<{ saved: boolean; revision: number; updatedAt?: number }>;
      openAsset(path: string): Promise<string>;
      revealAsset(path: string): Promise<void>;
      renameAsset(assetId: string, name: string): Promise<{ previousPath: string; assets: Asset[] }>;
      trashAsset(assetId: string): Promise<{ removedIds: string[] }>;
      copyToDesktop(assetId: string): Promise<string>;
      getFileIcon(path: string): Promise<string>;
      getAISettings(): Promise<AISettings>;
      saveAISettings(input: Partial<AISettings> & { apiKey?: string }): Promise<AISettings>;
      testAIConnection(): Promise<{ ok: boolean; message: string }>;
      generateAIAnswer(input: { question: string; evidence?: Citation[]; instructions?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; attachments?: AIAttachment[] }): Promise<{ text: string; provider: string; model: string }>;
      generateMedia(input: { type: 'image-generation' | 'video-generation'; prompt: string; model?: string }): Promise<{ status: string; path?: string; jobId?: string; progress?: number }>;
      writeClipboard(text: string): Promise<boolean>;
      onAssetProgress(callback: (event: ProgressEvent) => void): () => void;
      listenForDrops(callback: (paths: string[], position?: { x: number; y: number }) => void): () => void;
    };
  }
}

export {};
