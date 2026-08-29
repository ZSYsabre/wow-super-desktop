import { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useReactFlow, useStore, type EdgeProps, type XYPosition } from '@xyflow/react';
import { Bot, Check, GripHorizontal, Image as ImageIcon, Play, Settings, Video, X } from 'lucide-react';
import { useCanvasStore } from '../store';
import type { CanvasEdge, EdgeAIAction } from '../types';

const edgePalettes = [
  { line: '#9188ff', flow: '#d2ceff', glow: 'rgba(145,136,255,.58)' },
  { line: '#49b9d2', flow: '#b9f2ff', glow: 'rgba(73,185,210,.52)' },
  { line: '#e0a24f', flow: '#ffe0aa', glow: 'rgba(224,162,79,.5)' },
];

function paletteForEdge(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  return edgePalettes[Math.abs(hash) % edgePalettes.length];
}

function KnowledgeEdgeComponent(props: EdgeProps<CanvasEdge>) {
  const updateEdge = useCanvasStore((state) => state.updateEdge);
  const connectFromEdge = useCanvasStore((state) => state.connectFromEdge);
  const flow = useReactFlow();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<EdgeAIAction>(props.data?.action || 'ai-analysis');
  const [instructions, setInstructions] = useState(props.data?.instructions || actionPrompt(props.data?.action || 'ai-analysis'));
  const [provider, setProvider] = useState(props.data?.provider || 'deepseek');
  const [baseUrl, setBaseUrl] = useState(props.data?.baseUrl || 'https://api.deepseek.com');
  const [model, setModel] = useState(props.data?.model || 'deepseek-v4-flash');
  const [apiKey, setApiKey] = useState('');
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const [connectionDraft, setConnectionDraft] = useState<XYPosition | null>(null);
  const zoom = useStore((state) => state.transform[2]);
  const dotSize = Math.max(26, Math.min(58, 28 / Math.max(zoom, 0.2)));
  const junctionSize = Math.max(10, Math.min(28, 11 / Math.max(zoom, 0.2)));
  const panelScale = Math.max(1, Math.min(3.5, 1 / Math.max(zoom, 0.2)));
  const palette = paletteForEdge(props.data?.originEdgeId || props.id);
  const resultGeometry = useStore((state) => {
    if (!props.data?.resultLink || !props.data.originEdgeId) return null;
    const origin = state.edges.find((edge) => edge.id === props.data?.originEdgeId);
    const sourceNode = origin ? state.nodeLookup.get(origin.source) : undefined;
    const targetNode = origin ? state.nodeLookup.get(origin.target) : undefined;
    const resultNode = state.nodeLookup.get(props.target);
    if (!sourceNode || !targetNode || !resultNode) return null;
    const sourceWidth = sourceNode.measured.width || sourceNode.width || 0;
    const sourceHeight = sourceNode.measured.height || sourceNode.height || 0;
    const targetWidth = targetNode.measured.width || targetNode.width || 0;
    const targetHeight = targetNode.measured.height || targetNode.height || 0;
    const sourceX = (sourceNode.internals.positionAbsolute.x + sourceWidth / 2 + targetNode.internals.positionAbsolute.x + targetWidth / 2) / 2;
    const sourceY = (sourceNode.internals.positionAbsolute.y + sourceHeight / 2 + targetNode.internals.positionAbsolute.y + targetHeight / 2) / 2;
    const resultWidth = resultNode.measured.width || resultNode.width || 0;
    const resultHeight = resultNode.measured.height || resultNode.height || 0;
    const resultX = resultNode.internals.positionAbsolute.x;
    const resultY = resultNode.internals.positionAbsolute.y;
    const candidates = [
      { x: resultX + resultWidth / 2, y: resultY, position: Position.Top },
      { x: resultX + resultWidth, y: resultY + resultHeight / 2, position: Position.Right },
      { x: resultX + resultWidth / 2, y: resultY + resultHeight, position: Position.Bottom },
      { x: resultX, y: resultY + resultHeight / 2, position: Position.Left },
    ];
    const target = candidates.reduce((nearest, candidate) => Math.hypot(candidate.x - sourceX, candidate.y - sourceY) < Math.hypot(nearest.x - sourceX, nearest.y - sourceY) ? candidate : nearest);
    const deltaX = target.x - sourceX;
    const deltaY = target.y - sourceY;
    const sourcePosition = Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? Position.Right : Position.Left) : (deltaY > 0 ? Position.Bottom : Position.Top);
    return { sourceX, sourceY, targetX: target.x, targetY: target.y, sourcePosition, targetPosition: target.position };
  });
  const sourceX = resultGeometry?.sourceX ?? props.sourceX;
  const sourceY = resultGeometry?.sourceY ?? props.sourceY;
  const targetX = resultGeometry?.targetX ?? props.targetX;
  const targetY = resultGeometry?.targetY ?? props.targetY;
  const parallel = useStore((state) => state.edges.filter((edge) =>
    (edge.source === props.source && edge.target === props.target) ||
    (edge.source === props.target && edge.target === props.source)
  ));
  const parallelIndex = parallel.findIndex((edge) => edge.id === props.id);
  const spread = parallel.length > 1 ? (parallelIndex - (parallel.length - 1) / 2) * 24 : 0;
  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath({ ...props, sourceX, sourceY, targetX, targetY, sourcePosition: resultGeometry?.sourcePosition ?? props.sourcePosition, targetPosition: resultGeometry?.targetPosition ?? props.targetPosition });
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const controlX = (sourceX + targetX) / 2 - (dy / distance) * spread;
  const controlY = (sourceY + targetY) / 2 + (dx / distance) * spread;
  const path = parallel.length > 1 && !resultGeometry ? `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}` : bezierPath;
  const labelX = parallel.length > 1 && !resultGeometry ? (sourceX + 2 * controlX + targetX) / 4 : bezierLabelX;
  const labelY = parallel.length > 1 && !resultGeometry ? (sourceY + 2 * controlY + targetY) / 4 : bezierLabelY;
  const kind = props.data?.kind || 'relation';
  const openEditor = async () => {
    setOpen(!open);
    if (open) return;
    setModelSettingsOpen(false);
    const settings = await window.desktop.getAISettings();
    setProvider(props.data?.provider || settings.provider);
    setBaseUrl(props.data?.baseUrl || settings.baseUrl);
    setModel(props.data?.model || settings.model);
  };
  const save = async (close = true) => {
    updateEdge(props.id, { action, instructions, provider, baseUrl, model });
    const settings = await window.desktop.getAISettings();
    await window.desktop.saveAISettings({ ...settings, provider, baseUrl, model, apiKey });
    setApiKey(''); if (close) setOpen(false);
  };
  const run = async () => { await save(false); window.dispatchEvent(new CustomEvent('run-edge-action', { detail: { edgeId: props.id, action, instructions, model } })); setOpen(false); };
  const chooseAction = (next: EdgeAIAction) => { setAction(next); if (!instructions || instructions === actionPrompt(action)) setInstructions(actionPrompt(next)); };
  const chooseProvider = (next: string) => { setProvider(next); if (next === 'deepseek') { setBaseUrl('https://api.deepseek.com'); setModel('deepseek-v4-flash'); } else if (next === 'openai') { setBaseUrl('https://api.openai.com/v1'); setModel('gpt-5.4'); } };
  const startPanelDrag = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault(); event.stopPropagation();
    const start = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const initial = { ...panelOffset };
    const move = (pointerEvent: PointerEvent) => {
      const current = flow.screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      setPanelOffset({ x: initial.x + current.x - start.x, y: initial.y + current.y - start.y });
    };
    const finish = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  };
  const startBranchConnection = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation();
    setConnectionDraft({ x: labelX, y: labelY });
    const move = (pointerEvent: PointerEvent) => setConnectionDraft(flow.screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY }));
    const finish = (pointerEvent: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      setConnectionDraft(null);
      const element = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const targetId = element?.closest<HTMLElement>('.react-flow__node')?.dataset.id;
      if (targetId) connectFromEdge(props.id, targetId);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finish, { once: true });
  };
  const ActionIcon = action === 'image-generation' ? ImageIcon : action === 'video-generation' ? Video : Bot;
  return <>
    <BaseEdge path={path} markerEnd={props.markerEnd} style={{ vectorEffect: 'non-scaling-stroke', stroke: palette.line, strokeWidth: props.selected ? 4 : 3.2, strokeDasharray: kind === 'workflow' ? '8 6' : undefined, filter: `drop-shadow(0 0 ${props.selected || props.data?.action ? 4 : 2}px ${palette.glow})` }} />
    <BaseEdge path={path} className={`edge-flow-stream ${props.data?.action || props.data?.resultLink ? 'is-ai-flow' : ''}`} style={{ vectorEffect: 'non-scaling-stroke', stroke: palette.flow, strokeWidth: props.data?.action || props.data?.resultLink ? 3.4 : 2.7, strokeDasharray: props.data?.action || props.data?.resultLink ? '2 13' : '1 14', strokeLinecap: 'round' }} />
    {connectionDraft && <path className="edge-junction-preview" d={`M ${labelX},${labelY} L ${connectionDraft.x},${connectionDraft.y}`} />}
    <EdgeLabelRenderer><div className={`edge-action-anchor nodrag nopan ${props.data?.resultLink ? 'result-link-anchor' : ''}`} style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}>{props.data?.resultLink ? <span className="result-link-label">{props.label || '由此连线分析'}</span> : <><button style={{ width: dotSize, height: dotSize }} className={`edge-action-dot ${props.data?.action ? 'configured' : ''}`} onClick={() => void openEditor()} title="设置连线 AI 动作"><ActionIcon size={Math.max(12, Math.min(26, 13 / Math.max(zoom, 0.2)))}/></button><button style={{ width: junctionSize, height: junctionSize, right: -junctionSize * .28, bottom: -junctionSize * .28 }} className="edge-junction-handle" onPointerDown={startBranchConnection} onClick={(event) => { event.preventDefault(); event.stopPropagation(); }} title="从连接点拖出新连线" aria-label="从连接点拖出新连线"/>{props.label && <span className="edge-action-label">{props.label}</span>}{open && <section className={`edge-action-panel nowheel ${modelSettingsOpen ? 'model-settings-open' : ''}`} style={{ left: dotSize + 5 + panelOffset.x, top: -18 + panelOffset.y, transform: `scale(${panelScale})`, transformOrigin: 'top left' }}><header onPointerDown={startPanelDrag} title="拖动此处移动配置框"><div><strong><GripHorizontal size={13}/>连线 AI 动作</strong><span>拖动标题栏移动 · 自动读取整组相连资料</span></div><div className="edge-panel-header-actions"><button className={modelSettingsOpen ? 'active' : ''} onClick={() => setModelSettingsOpen(!modelSettingsOpen)} title={modelSettingsOpen ? '收起模型与 API 设置' : '单独设置模型与 API'}><Settings size={14}/></button><button onClick={() => setOpen(false)} title="关闭"><X size={14}/></button></div></header><nav><button className={action === 'ai-analysis' ? 'active' : ''} onClick={() => chooseAction('ai-analysis')}><Bot size={14}/>AI 分析</button><button className={action === 'image-generation' ? 'active' : ''} onClick={() => chooseAction('image-generation')}><ImageIcon size={14}/>生图</button><button className={action === 'video-generation' ? 'active' : ''} onClick={() => chooseAction('video-generation')}><Video size={14}/>生视频</button></nav><label>系统提示词<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="定义整组相连资料如何融合处理…"/></label>{modelSettingsOpen && <section className="edge-model-settings"><header><div><strong>模型与 API</strong><span>仅在需要为这条连线单独覆盖时设置</span></div><button onClick={() => setModelSettingsOpen(false)} title="收起"><X size={12}/></button></header><div className="edge-api-grid"><label>服务商<select value={provider} onChange={(event) => chooseProvider(event.target.value)}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="compatible">兼容 API</option></select></label><label>模型<input value={model} onChange={(event) => setModel(event.target.value)} placeholder={action === 'image-generation' ? '生图模型名称' : action === 'video-generation' ? '视频模型名称' : 'deepseek-v4-flash'}/></label></div><label>API 地址<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)}/></label><label>API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="留空不覆盖已安全保存的密钥"/></label></section>}<footer><button className="edge-model-summary" title="打开模型与 API 设置" onClick={() => setModelSettingsOpen(!modelSettingsOpen)}><Settings size={12}/><span>{provider} · {model}</span></button><div><button onClick={() => void run()}><Play size={12}/>运行</button><button className="primary" onClick={() => void save()}><Check size={12}/>保存</button></div></footer></section>}</>}</div></EdgeLabelRenderer>
  </>;
}

function actionPrompt(action: EdgeAIAction) {
  if (action === 'image-generation') return '基于连线两端的内容，提取关键视觉概念，生成构图清晰、风格统一的图像。';
  if (action === 'video-generation') return '基于连线两端的内容，生成节奏明确、画面连贯的视频方案。';
  return '融合分析整组相连文件的内容，找出关键关系、差异与可执行结论，并生成一份逻辑完整的新文档。';
}

export const KnowledgeEdge = memo(KnowledgeEdgeComponent);
