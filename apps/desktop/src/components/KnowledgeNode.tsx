import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bot, Check, CheckSquare2, Copy, Database, FileText, Folder, LoaderCircle, MessageSquareText, Send, Settings, Sparkles, StickyNote, X } from 'lucide-react';
import { Handle, NodeResizer, Position, useStore, type NodeProps } from '@xyflow/react';
import type { AIAttachment, Asset, CanvasNode, Citation } from '../types';
import { collectScope, useCanvasStore } from '../store';
import { CanvasMarkdown } from './CanvasMarkdown';

const icons = {
  file: FileText, folder: Folder, 'knowledge-base': Database, ai: Bot,
  answer: MessageSquareText, task: CheckSquare2, note: StickyNote,
};

const INDEXABLE_EXTENSIONS = new Set([
  '', '.pdf', '.docx', '.txt', '.md', '.markdown', '.html', '.htm', '.csv', '.json', '.jsonl',
  '.yaml', '.yml', '.xml', '.rtf', '.log', '.ini', '.conf', '.toml', '.js', '.jsx', '.ts', '.tsx',
  '.css', '.scss', '.py', '.sh', '.sql',
]);

function KnowledgeNodeComponent({ id, data, selected }: NodeProps<CanvasNode>) {
  const Icon = icons[data.kind];
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [askNotice, setAskNotice] = useState('');
  const [answerText, setAnswerText] = useState(data.body || '');
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState(data.instructions || '');
  const [nativeIcon, setNativeIcon] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(data.title);
  const [copied, setCopied] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const zoom = useStore((state) => state.transform[2]);
  const connectionHandleSize = Math.max(10, Math.min(38, 11 / Math.max(zoom, 0.2)));
  const { nodes, edges, assets, updateNode, detachNodeFromKnowledge, interactionMode, locatedId } = useCanvasStore();
  const selectedNodeCount = nodes.filter((node) => node.selected && !node.hidden).length;
  const asset = data.assetId ? assets.find((item) => item.id === data.assetId) : undefined;
  const isDesktopAsset = data.kind === 'file' || data.kind === 'folder';
  const isVideoPreview = Boolean(asset && ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.mpeg', '.mpg'].includes(asset.extension.toLowerCase()));
  const isQuickLookDocument = Boolean(nativeIcon && asset && ['.docx', '.doc', '.pdf', '.pages', '.rtf'].includes(asset.extension.toLowerCase()));

  useEffect(() => {
    let active = true;
    if (!asset?.path) { setNativeIcon(''); return; }
    void window.desktop.getFileIcon(asset.path).then((icon) => { if (active) setNativeIcon(icon); }).catch(() => { if (active) setNativeIcon(''); });
    return () => { active = false; };
  }, [asset?.path]);

  useEffect(() => { setVideoFailed(false); }, [asset?.id]);
  useEffect(() => { if (data.body) setAnswerText(data.body); }, [data.body]);

  const openNode = () => {
    if (data.documentType) window.dispatchEvent(new CustomEvent('open-canvas-document', { detail: { nodeId: id } }));
    else if (asset?.kind === 'file' && isVideoPreview) window.dispatchEvent(new CustomEvent('open-canvas-video', { detail: { assetId: asset.id } }));
    else if (asset?.kind === 'file') void window.desktop.openAsset(asset.path);
    else if (data.kind === 'folder' && interactionMode === 'pan') window.dispatchEvent(new CustomEvent('open-folder-canvas', { detail: { nodeId: id, assetId: data.assetId } }));
  };

  const commitTitle = () => {
    const title = titleDraft.trim();
    if (title && title !== data.title) updateNode(id, { title });
    else setTitleDraft(data.title);
    setEditingTitle(false);
  };

  const copyBody = async (content = data.body || '') => {
    if (!content) return;
    await window.desktop.writeClipboard(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const ask = async () => {
    if (!question.trim() || asking) return;
    setAsking(true); setError(''); setAskNotice('正在读取知识库资料…');
    updateNode(id, { status: 'processing' });
    try {
      const knowledgeChildren = data.kind === 'knowledge-base' ? (data.childNodeIds || []).map((childId) => nodes.find((node) => node.id === childId)).filter(Boolean) as CanvasNode[] : [];
      const assetIds = data.kind === 'knowledge-base'
        ? knowledgeChildren.map((node) => node.data.assetId).filter(Boolean) as string[]
        : collectScope(id, nodes, edges);
      const documentAssetIds = assetIds.filter((assetId) => {
        const item = assets.find((candidate) => candidate.id === assetId);
        return Boolean(item && item.kind === 'file' && INDEXABLE_EXTENSIONS.has(item.extension.toLowerCase()));
      });
      const virtualEvidence: Citation[] = knowledgeChildren.filter((node) => node.data.documentContent?.trim()).map((node) => ({
        chunkId: `canvas:${node.id}`, assetId: `canvas:${node.id}`, source: node.data.title,
        sourcePath: '', locator: '画布文档正文', text: node.data.documentContent || '', score: 1,
      }));
      if (data.kind === 'knowledge-base' && !assetIds.length && !virtualEvidence.length) throw new Error('请先把文件或文档拖入这个知识库');
      if (documentAssetIds.length) await window.desktop.ensureKnowledgeIndexed(documentAssetIds);
      const evidence = [...await window.desktop.readKnowledge(documentAssetIds), ...virtualEvidence];
      const attachments: AIAttachment[] = data.kind === 'knowledge-base' ? knowledgeChildren.map((node) => assets.find((item) => item.id === node.data.assetId)).filter((item): item is Asset => Boolean(item && /^\.(png|jpe?g|webp|gif|bmp)$/i.test(item.extension))).map((item) => ({ name: item.name, path: item.path, kind: item.kind, extension: item.extension, assetId: item.id })) : [];
      const settings = await window.desktop.getAISettings();
      if (!settings.configured) {
        const localAnswer = evidence.length ? `未配置 AI，已找到 ${evidence.length} 条关键证据。\n\n${evidence.map((item, index) => `[${index + 1}] ${item.source} · ${item.locator}\n${item.text.slice(0, 180)}…`).join('\n\n')}` : '没有检索到相关证据。';
        setAnswerText(localAnswer);
        updateNode(id, { body: localAnswer, citations: evidence, status: 'ready' });
        setAskNotice('尚未配置 AI，已生成本地资料摘要');
      } else {
        setAskNotice(`资料已读取，正在调用 ${settings.provider} · ${settings.model}…`);
        const scopeRule = data.kind === 'knowledge-base' ? `你正在回答知识库“${data.title}”的专属问题。只能使用该知识库内附上的文件、文档和图片，不得引用画布其他资料；资料不足时要明确说明。` : '';
        const result = await window.desktop.generateAIAnswer({ question, evidence, attachments, instructions: `${data.instructions || settings.instructions}\n\n${scopeRule}\n\n请使用清晰的 Markdown 排版：以标题划分结构，分段表达，使用列表和加粗突出重点。` });
        setAnswerText(result.text);
        updateNode(id, { body: result.text, citations: evidence, status: 'ready' });
        setAskNotice('回答已生成');
        window.requestAnimationFrame(() => { if (answerRef.current) answerRef.current.scrollTop = 0; });
      }
      setQuestion('');
    } catch (reason) { setAskNotice(''); setError(reason instanceof Error ? reason.message : String(reason)); updateNode(id, { status: 'failed' }); }
    finally { setAsking(false); }
  };

  return <article style={{ '--connection-handle-size': `${connectionHandleSize}px` } as CSSProperties} className={`knowledge-node kind-${data.kind} ${data.kind === 'knowledge-base' && answerText ? 'has-kb-answer' : ''} ${isDesktopAsset ? 'desktop-asset-node' : ''} ${selected ? 'is-selected' : ''} ${locatedId === id ? 'is-located' : ''}`} onDoubleClick={openNode}>
    <NodeResizer isVisible={selected && selectedNodeCount < 2} handleClassName="node-resize-handle" lineClassName="node-resize-line" color="#8f87ff" keepAspectRatio={isDesktopAsset} minWidth={isDesktopAsset ? 78 : data.kind === 'ai' ? 280 : data.kind === 'answer' ? 280 : 160} minHeight={isDesktopAsset ? 78 : data.kind === 'ai' ? 190 : data.kind === 'answer' ? 170 : 100} maxWidth={isDesktopAsset ? 480 : 720} maxHeight={isDesktopAsset ? 480 : 620} />
    <Handle type="source" position={Position.Left} id="left" title="拖到另一个节点建立连线" /><Handle type="source" position={Position.Top} id="top" title="拖到另一个节点建立连线" /><Handle type="source" position={Position.Right} id="right" title="拖到另一个节点建立连线" /><Handle type="source" position={Position.Bottom} id="bottom" title="拖到另一个节点建立连线" />
    <header><span className={`node-kind-icon ${(nativeIcon || asset || ['file','folder'].includes(data.kind)) ? 'native' : ''} ${isQuickLookDocument ? 'quicklook-document' : ''} ${isVideoPreview ? 'quicklook-video' : ''}`}>{isVideoPreview && !videoFailed ? <video key={asset!.id} src={`wow-media://asset/${asset!.id}`} autoPlay loop muted playsInline preload="auto" draggable={false} onError={() => setVideoFailed(true)} aria-label={`${data.title}视频预览`}/> : nativeIcon ? <img src={nativeIcon} alt=""/> : (asset || ['file','folder'].includes(data.kind)) ? <span className="macos-file-icon"><img src={(asset?.kind || data.kind) === 'folder' ? '/macos-folder.png' : '/macos-document.png'} alt=""/>{(asset?.kind || data.kind) === 'file' && <b>{asset?.extension.slice(1, 5).toUpperCase() || 'FILE'}</b>}</span> : <Icon size={18} />}</span><div><small>{data.subtitle || data.kind}</small>{editingTitle ? <input className="node-title-input nodrag nopan" autoFocus value={titleDraft} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => setTitleDraft(event.target.value)} onBlur={commitTitle} onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitTitle(); } if (event.key === 'Escape') { setTitleDraft(data.title); setEditingTitle(false); } }}/>:<strong className="node-title nodrag nopan" title="双击编辑名称" onPointerDown={(event) => event.stopPropagation()} onDoubleClickCapture={(event) => { event.preventDefault(); event.stopPropagation(); setTitleDraft(data.title); setEditingTitle(true); }}>{data.title}</strong>}</div>{Boolean(data.body) && ['ai', 'answer'].includes(data.kind) && <button className="node-content-copy nodrag nopan" title="一键复制全部内容" onClick={(event) => { event.stopPropagation(); void copyBody(); }}>{copied ? <Check size={13}/> : <Copy size={13}/>}</button>}{data.kind === 'ai' && <button className="node-prompt-button nodrag" title="设置该 AI 节点的系统提示词" onClick={() => { setPromptDraft(data.instructions || ''); setPromptOpen(!promptOpen); }}><Settings size={13}/></button>}{data.status && <em className={`node-status status-${data.status}`}>{statusText(data.status)}</em>}</header>
    {data.kind === 'knowledge-base' && <>
      <div className="kb-sources"><span><Folder size={12} />拖入文件资料</span><span><Sparkles size={12} />限定 AI 范围</span></div>
      <div className={`kb-drop-area ${(data.childNodeIds || []).length ? 'has-items' : ''}`}>{(data.childNodeIds || []).length ? (data.childNodeIds || []).map((childId) => { const child = nodes.find((node) => node.id === childId); if (!child) return null; const childAsset = child.data.assetId ? assets.find((item) => item.id === child.data.assetId) : undefined; return <div className="kb-child-item nodrag nopan" key={childId} onDoubleClick={(event) => { event.stopPropagation(); if (child.data.documentType) window.dispatchEvent(new CustomEvent('open-canvas-document', { detail: { nodeId: childId } })); else if (childAsset?.path) void window.desktop.openAsset(childAsset.path); }}><ChildPreview asset={childAsset} kind={child.data.kind}/><div><strong>{child.data.title}</strong><small>{child.data.subtitle || '关联资料'}</small></div><button title="移出知识库" onClick={(event) => { event.stopPropagation(); detachNodeFromKnowledge(id, childId); }}><X size={12}/></button></div>; }) : <div className="kb-drop-empty"><Folder size={20}/><strong>把文件、图片或文档拖到这里</strong><span>拖入后会收纳为这个知识库的关联资料</span></div>}</div>
      {answerText && <div ref={answerRef} className="kb-answer nodrag nopan nowheel" onWheelCapture={(event) => event.stopPropagation()}><div className="kb-answer-head"><small>知识库回答</small><button title="一键复制全部内容" onClick={() => void copyBody(answerText)}>{copied ? <Check size={12}/> : <Copy size={12}/>}</button></div><CanvasMarkdown text={answerText}/></div>}
      <form className="kb-question-input nodrag nopan" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void ask(); }} onClick={(event) => event.stopPropagation()}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={asking ? '正在处理，请稍候…' : '仅向这个知识库提问…'} disabled={asking}/><button title={asking ? '正在生成回答' : '提问'} disabled={asking || !question.trim()}>{asking ? <LoaderCircle className="spin" size={14}/> : <Send size={14}/>}</button></form>
      {data.kind === 'knowledge-base' && !error && askNotice && <p className={`kb-question-feedback ${asking ? 'is-loading' : 'is-ready'}`}>{asking && <LoaderCircle className="spin" size={11}/>}<span>{askNotice}</span></p>}
      {data.kind === 'knowledge-base' && error && <p className="kb-question-error">{error}</p>}
    </>}
    {data.kind === 'ai' && <><div className="node-body markdown-lite nodrag nopan nowheel" onWheelCapture={(event) => event.stopPropagation()}><CanvasMarkdown text={data.body || '连接资料后，在这里发起分析。'}/></div>{Boolean(data.citations?.length) && <div className="node-citations">{data.citations?.slice(0, 3).map((item, index) => <button key={item.chunkId} onClick={() => void window.desktop.openAsset(item.sourcePath)}>[{index + 1}] {item.source}</button>)}</div>}{promptOpen && <section className="node-prompt-editor nodrag nopan nowheel"><header><strong>系统提示词</strong><button onClick={() => setPromptOpen(false)}><X size={12}/></button></header><textarea value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} placeholder="留空则使用全局资料问答提示词…"/><footer><span>仅对该 AI 节点生效</span><button onClick={() => { updateNode(id, { instructions: promptDraft }); setPromptOpen(false); }}><Check size={12}/>保存</button></footer></section>}<div className="ai-node-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(); } }} placeholder={asking ? '分析中…' : '继续提问…'} disabled={asking} /><button onClick={() => void ask()} disabled={asking}><Send size={13} /></button></div>{error && <p className="node-error">{error}</p>}</>}
    {(data.kind === 'answer' || data.kind === 'note' || data.kind === 'task') && <div className={`node-body ${data.kind === 'answer' ? 'nodrag nopan nowheel answer-scroll-area' : ''}`} onWheelCapture={data.kind === 'answer' ? (event) => event.stopPropagation() : undefined}>{data.kind === 'answer' ? <CanvasMarkdown text={data.body || '暂无内容'}/> : data.body || (data.kind === 'note' ? '双击添加注释' : '暂无内容')}</div>}
    {(data.kind === 'file' || data.kind === 'folder') && <div className="asset-foot"><span>{asset?.kind === 'folder' ? `${asset.childCount || 0} 个项目` : asset?.extension.slice(1).toUpperCase()}</span><span>{asset?.indexStatus ? statusText(asset.indexStatus) : '画布对象'}</span></div>}
  </article>;
}

function statusText(status: string) {
  return ({ pending: '等待处理', scanning: '正在扫描', processing: '正在解析', ready: '已索引', failed: '处理失败', unsupported: '暂不支持', virtual: '画布对象' } as Record<string, string>)[status] || status;
}

function ChildPreview({ asset, kind }: { asset?: Asset; kind: CanvasNode['data']['kind'] }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    let active = true;
    if (!asset?.path) { setPreview(''); return; }
    void window.desktop.getFileIcon(asset.path).then((value) => { if (active) setPreview(value); }).catch(() => { if (active) setPreview(''); });
    return () => { active = false; };
  }, [asset?.path]);
  const documentPreview = Boolean(asset && ['.docx', '.doc', '.pdf', '.pages', '.rtf'].includes(asset.extension.toLowerCase()));
  return <span className={`kb-child-preview ${preview ? 'image' : ''} ${documentPreview ? 'document' : ''}`}>{preview ? <img src={preview} alt=""/> : kind === 'folder' ? <Folder size={16}/> : <FileText size={16}/>}</span>;
}

export const KnowledgeNode = memo(KnowledgeNodeComponent);
