'use client';

import {
  AlertCircle, ArrowUp, Bot, BrainCircuit, Check, CheckSquare2, ChevronDown,
  Clock3, Copy, Database, ExternalLink, FileSearch, FileText, Folder,
  LayoutDashboard, MessageSquareText, Minimize2, Minus, MousePointer2,
  Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, StickyNote,
  Sun, Upload, X, Zap,
} from 'lucide-react';
import { useState } from 'react';

type NodeId = 'interviews' | 'competitors' | 'knowledge' | 'analysis' | 'answer' | 'task' | 'note';

const nodeMeta: Record<NodeId, { label: string; eyebrow: string }> = {
  interviews: { label: '用户访谈', eyebrow: '文件夹 · 12 个文件' },
  competitors: { label: '竞品资料', eyebrow: '文件夹 · 8 个文件' },
  knowledge: { label: '新产品调研', eyebrow: '知识库 · 20 份资料' },
  analysis: { label: '产品机会分析', eyebrow: 'AI 分析 · 已完成' },
  answer: { label: '核心结论', eyebrow: '结论 · 4 条引用' },
  task: { label: '下一步行动', eyebrow: '任务 · 待确认' },
  note: { label: '研究重点', eyebrow: '注释' },
};

export default function Home() {
  const [selected, setSelected] = useState<NodeId>('analysis');
  const [panel, setPanel] = useState<'assets' | 'knowledge' | 'tasks' | 'search' | 'status' | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFolder, setShowFolder] = useState(false);
  const [zoom, setZoom] = useState(84);
  const [question, setQuestion] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <main className="app-shell">
      <aside className="rail" aria-label="主导航">
        <div className="brand-mark" aria-label="哇塞-超级桌面"><Sparkles size={18} strokeWidth={2.2} /></div>
        <nav className="rail-nav">
          <button onClick={() => setPanel(null)} className={`rail-button ${panel === null ? 'active' : ''}`} aria-label="画布"><LayoutDashboard size={19} /></button>
          <button onClick={() => setPanel(panel === 'assets' ? null : 'assets')} className={`rail-button ${panel === 'assets' ? 'active' : ''}`} aria-label="资料"><Folder size={19} /></button>
          <button onClick={() => setPanel(panel === 'knowledge' ? null : 'knowledge')} className={`rail-button ${panel === 'knowledge' ? 'active' : ''}`} aria-label="知识库"><Database size={19} /></button>
          <button onClick={() => setPanel(panel === 'tasks' ? null : 'tasks')} className={`rail-button ${panel === 'tasks' ? 'active' : ''}`} aria-label="任务"><CheckSquare2 size={19} /></button>
          <button onClick={() => setPanel(panel === 'search' ? null : 'search')} className={`rail-button ${panel === 'search' ? 'active' : ''}`} aria-label="搜索"><Search size={19} /></button>
        </nav>
        <div className="rail-bottom">
          <button onClick={() => setPanel(panel === 'status' ? null : 'status')} className={`rail-button status-button ${panel === 'status' ? 'active' : ''}`} aria-label="处理状态"><Zap size={18} /><span /></button>
          <button onClick={() => setShowSettings(true)} className="rail-button" aria-label="设置"><Settings size={19} /></button>
        </div>
      </aside>

      {panel && <SidePanel panel={panel} onClose={() => setPanel(null)} onSelect={(id) => { setSelected(id); setPanel(null); }} onNotify={notify} />}

      <section className="workspace">
        <header className="topbar">
          <div className="project-identity">
            <div className="project-icon"><BrainCircuit size={17} /></div>
            <div>
              <div className="project-title-row"><h1>哇塞-超级桌面</h1><span>/</span><strong>新产品调研</strong><ChevronDown size={14} /></div>
              <p>最后保存于 1 分钟前</p>
            </div>
          </div>
          <div className="top-actions">
            <button onClick={() => setPanel('search')} className="search-button"><Search size={15} />搜索画布 <kbd>⌘ K</kbd></button>
            <button onClick={() => notify('浅色画布主题已保存')} className="icon-button" aria-label="切换主题"><Sun size={17} /></button>
            <button onClick={() => setShowAI(!showAI)} className={`quick-ai ${showAI ? 'active' : ''}`}><Sparkles size={16} />AI 快问</button>
          </div>
        </header>

        <div className="canvas-frame">
          <div className="mode-switcher" aria-label="画布工具">
            <button className="tool active" aria-label="选择"><MousePointer2 size={16} /></button>
            <button className="tool" aria-label="拖动画布"><Minimize2 size={16} /></button><span />
            <button className="tool text-tool"><StickyNote size={15} />便签</button>
          </div>

          <div className="canvas-surface">
            <svg className="connections" viewBox="0 0 1300 760" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#687182" /></marker>
                <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8b80ff" /></marker>
              </defs>
              <path d="M 260 208 C 345 208, 350 284, 440 284" markerEnd="url(#arrow)" />
              <path d="M 260 472 C 345 472, 350 330, 440 330" markerEnd="url(#arrow)" />
              <path className="ai-edge" d="M 660 304 C 735 304, 740 304, 805 304" markerEnd="url(#arrow-purple)" />
              <path className="workflow-edge" d="M 1037 304 C 1105 304, 1100 196, 1160 196" markerEnd="url(#arrow-purple)" />
              <path className="workflow-edge" d="M 1037 324 C 1105 324, 1100 470, 1160 470" markerEnd="url(#arrow-purple)" />
            </svg>
            <span className="edge-label relation-label">归入</span><span className="edge-label ai-label">提供给 AI</span><span className="edge-label output-label">生成</span>

            <CanvasNode id="interviews" selected={selected === 'interviews'} onSelect={setSelected} onOpen={() => setShowFolder(true)} className="node-interviews folder-node">
              <div className="node-icon amber"><Folder size={20} fill="currentColor" /></div><NodeText id="interviews" />
              <div className="file-stack"><i /><i /><i /></div><StatusPill tone="green">已索引</StatusPill>
            </CanvasNode>
            <CanvasNode id="competitors" selected={selected === 'competitors'} onSelect={setSelected} onOpen={() => setShowFolder(true)} className="node-competitors folder-node">
              <div className="node-icon cyan"><Folder size={20} fill="currentColor" /></div><NodeText id="competitors" />
              <div className="file-stack"><i /><i /><i /></div><StatusPill tone="green">已索引</StatusPill>
            </CanvasNode>
            <CanvasNode id="knowledge" selected={selected === 'knowledge'} onSelect={setSelected} className="node-knowledge knowledge-node">
              <div className="node-heading"><div className="node-icon violet"><Database size={18} /></div><NodeText id="knowledge" /></div>
              <div className="source-list"><span><Folder size={13} />用户访谈</span><span><Folder size={13} />竞品资料</span><small>+ 18 份资料</small></div>
            </CanvasNode>
            <CanvasNode id="analysis" selected={selected === 'analysis'} onSelect={setSelected} className="node-analysis ai-node">
              <div className="node-heading"><div className="node-icon purple"><Bot size={18} /></div><NodeText id="analysis" /></div>
              <p className="ai-copy">用户更重视资料之间的联系，而不仅是单篇总结。建议优先验证“可追溯结论”与“任务转化”两条路径。</p>
              <div className="citation-row"><span>[1] 访谈纪要 · 第 4 页</span><span>[2] 竞品报告</span></div>
              <div className="node-prompt"><span>继续追问…</span><Sparkles size={14} /></div>
            </CanvasNode>
            <CanvasNode id="answer" selected={selected === 'answer'} onSelect={setSelected} className="node-answer answer-node">
              <div className="node-heading"><div className="node-icon blue"><MessageSquareText size={17} /></div><NodeText id="answer" /></div>
              <p>机会不在“更多功能”，而在让每个结论都能回到原始证据。</p><span className="node-link">查看 4 条来源</span>
            </CanvasNode>
            <CanvasNode id="task" selected={selected === 'task'} onSelect={setSelected} className="node-task task-node">
              <div className="node-heading"><div className="node-icon green"><CheckSquare2 size={18} /></div><NodeText id="task" /></div>
              <span className="task-line"><i />设计可追溯引用原型</span><span className="task-line"><i />约谈 5 位目标用户</span>
            </CanvasNode>
            <CanvasNode id="note" selected={selected === 'note'} onSelect={setSelected} className="node-note note-node">
              <NodeText id="note" /><p>不要只展示 AI 答案，要让用户一眼看懂它从哪里来。</p>
            </CanvasNode>
          </div>

          <div className="zoom-controls"><button onClick={() => setZoom(Math.max(20, zoom - 10))} aria-label="缩小"><Minus size={15} /></button><span>{zoom}%</span><button onClick={() => setZoom(Math.min(200, zoom + 10))} aria-label="放大"><Plus size={15} /></button></div>
          <div className="minimap" aria-label="画布缩略图"><i className="mini-a" /><i className="mini-b" /><i className="mini-c" /><i className="mini-d" /><span /></div>
          <form className="global-ask" onSubmit={(e) => { e.preventDefault(); if (question.trim()) setShowAnswer(true); }}>
            <div className="ask-scope"><Sparkles size={14} />全局 <span>·</span> 20 份资料<ChevronDown size={13} /></div>
            <div className="ask-row"><input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="向画布资料提问" placeholder="向整个画布提问，答案会附带来源…" /><button aria-label="发送"><ArrowUp size={16} /></button></div>
          </form>
        </div>
      </section>

      {showAI ? <AIChat onClose={() => setShowAI(false)} /> : (
        <aside className="inspector" aria-label="节点属性">
          <div className="inspector-head"><div><span>节点属性</span><p>编辑当前选中内容</p></div><button aria-label="关闭属性面板">×</button></div>
          <div className="selection-summary"><div className={`node-icon ${selected === 'task' ? 'green' : selected === 'answer' ? 'blue' : 'purple'}`}>{selected === 'task' ? <CheckSquare2 size={17} /> : selected === 'answer' ? <MessageSquareText size={17} /> : <Bot size={17} />}</div><div><strong>{nodeMeta[selected].label}</strong><span>{nodeMeta[selected].eyebrow}</span></div></div>
          <label className="field-label">名称<input value={nodeMeta[selected].label} readOnly /></label>
          <label className="field-label">说明<input value={nodeMeta[selected].eyebrow} readOnly /></label>
          {selected === 'analysis' && <label className="field-label">该节点的 AI 指令<textarea defaultValue="请综合全部连接资料，优先寻找不同来源之间的共识与冲突。每个重要判断必须标注引用。" /></label>}
          {selected === 'task' && <label className="field-label">任务内容<textarea defaultValue="完成可追溯引用原型，并邀请目标用户验证从结论返回原文的操作是否清晰。" /></label>}
          {selected === 'note' && <label className="field-label">注释内容<textarea defaultValue="不要只展示 AI 答案，要让用户一眼看懂它从哪里来。" /></label>}
          <div className="inspector-section"><div className="section-title"><span>{selected === 'analysis' || selected === 'knowledge' ? '连接的资料来源' : '节点关联'}</span><b>{selected === 'analysis' || selected === 'knowledge' ? 20 : 2}</b></div><div className="source-card"><Folder size={16} /><div><strong>用户访谈</strong><span>12 个文件 · 已索引</span></div></div><div className="source-card"><Folder size={16} /><div><strong>竞品资料</strong><span>8 个文件 · 已索引</span></div></div></div>
          <button onClick={() => notify('已显示该节点的全部引用范围')} className="secondary-action"><FileSearch size={16} />查看全部引用范围</button>
          <div className="local-note"><Database size={14} /><span>资料索引保存在本机</span></div>
        </aside>
      )}
      {showAnswer && <AnswerDialog question={question} onClose={() => setShowAnswer(false)} onSave={() => { setShowAnswer(false); setSelected('answer'); notify('回答已保存为结论节点'); }} />}
      {showFolder && <FolderCanvas onClose={() => setShowFolder(false)} onNotify={notify} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} onSave={() => { setShowSettings(false); notify('AI 设置已安全保存'); }} />}
      {toast && <div className="toast"><Check size={15} />{toast}</div>}
    </main>
  );
}

function CanvasNode({ id, selected, onSelect, onOpen, className, children }: { id: NodeId; selected: boolean; onSelect: (id: NodeId) => void; onOpen?: () => void; className: string; children: React.ReactNode }) {
  return <button type="button" className={`canvas-node ${className} ${selected ? 'selected' : ''}`} onClick={() => onSelect(id)} onDoubleClick={onOpen}>{children}<i className="handle left" /><i className="handle right" /></button>;
}
function NodeText({ id }: { id: NodeId }) { return <div className="node-text"><span>{nodeMeta[id].eyebrow}</span><strong>{nodeMeta[id].label}</strong></div>; }
function StatusPill({ children, tone }: { children: React.ReactNode; tone: string }) { return <span className={`status-pill ${tone}`}><i />{children}</span>; }

function SidePanel({ panel, onClose, onSelect, onNotify }: { panel: 'assets' | 'knowledge' | 'tasks' | 'search' | 'status'; onClose: () => void; onSelect: (id: NodeId) => void; onNotify: (message: string) => void }) {
  const titles = { assets: '资料', knowledge: '知识库', tasks: '任务', search: '搜索画布', status: '处理状态' };
  return <aside className="side-drawer">
    <div className="drawer-head"><div><span>{titles[panel]}</span><p>{panel === 'assets' ? '20 份本地资料' : panel === 'status' ? '所有资料处理正常' : '新产品调研工作区'}</p></div><button onClick={onClose} aria-label="关闭"><X size={16} /></button></div>
    {(panel === 'assets' || panel === 'search') && <div className="drawer-search"><Search size={14} /><input placeholder={panel === 'search' ? '搜索节点或资料…' : '筛选资料…'} /></div>}
    {panel === 'assets' && <><button onClick={() => onNotify('已打开系统文件选择器')} className="import-button"><Upload size={15} />添加文件或文件夹</button><DrawerGroup title="最近导入"><DrawerItem icon={<Folder size={16} />} title="用户访谈" meta="12 个文件 · 已索引" onClick={() => onSelect('interviews')} /><DrawerItem icon={<Folder size={16} />} title="竞品资料" meta="8 个文件 · 已索引" onClick={() => onSelect('competitors')} /><DrawerItem icon={<FileText size={16} />} title="访谈洞察汇总.pdf" meta="2.8 MB · 已索引" /></DrawerGroup><div className="drop-zone"><Upload size={18} /><strong>拖入本地文件</strong><span>PDF、Word、Markdown、TXT、HTML</span></div></>}
    {panel === 'knowledge' && <><button onClick={() => { onSelect('knowledge'); onNotify('已新建知识库节点'); }} className="import-button"><Plus size={15} />新建知识库</button><DrawerGroup title="当前画布"><DrawerItem icon={<Database size={16} />} title="新产品调研" meta="20 份资料 · 2 个来源" onClick={() => onSelect('knowledge')} /></DrawerGroup><div className="drawer-empty"><Database size={22} /><span>将资料拖到知识库节点<br/>即可建立来源关系</span></div></>}
    {panel === 'tasks' && <><div className="metric-row"><div><strong>2</strong><span>待确认</span></div><div><strong>1</strong><span>进行中</span></div><div><strong>4</strong><span>已完成</span></div></div><DrawerGroup title="下一步行动"><DrawerItem icon={<CheckSquare2 size={16} />} title="设计可追溯引用原型" meta="待确认" onClick={() => onSelect('task')} /><DrawerItem icon={<Clock3 size={16} />} title="约谈 5 位目标用户" meta="本周" onClick={() => onSelect('task')} /></DrawerGroup></>}
    {panel === 'search' && <><p className="result-count">找到 3 个与“引用”相关的节点</p><DrawerItem icon={<Bot size={16} />} title="产品机会分析" meta="AI 分析 · 命中正文" onClick={() => onSelect('analysis')} /><DrawerItem icon={<MessageSquareText size={16} />} title="核心结论" meta="结论 · 4 条引用" onClick={() => onSelect('answer')} /><DrawerItem icon={<CheckSquare2 size={16} />} title="设计可追溯引用原型" meta="任务" onClick={() => onSelect('task')} /></>}
    {panel === 'status' && <><div className="status-hero"><div className="status-ring">20</div><div><strong>全部资料已就绪</strong><span>最近更新于 1 分钟前</span></div></div><div className="status-list"><p><Check size={14} />已完成索引 <b>20</b></p><p><RefreshCw size={14} />正在处理 <b>0</b></p><p><AlertCircle size={14} />处理失败 <b>0</b></p><p><Sparkles size={14} />AI 结果节点 <b>3</b></p></div><button onClick={() => onNotify('已检查全部资料状态')} className="secondary-action"><RefreshCw size={14} />检查更新</button></>}
  </aside>;
}

function DrawerGroup({ title, children }: { title: string; children: React.ReactNode }) { return <section className="drawer-group"><h3>{title}</h3>{children}</section>; }
function DrawerItem({ icon, title, meta, onClick }: { icon: React.ReactNode; title: string; meta: string; onClick?: () => void }) { return <button className="drawer-item" onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{meta}</small></div><ChevronDown size={13} /></button>; }

function AIChat({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  return <aside className="inspector ai-chat"><div className="chat-head"><div className="chat-title"><span><Sparkles size={15} /></span><div><strong>AI 快问</strong><small>通用对话 · 不读取画布资料</small></div></div><button onClick={onClose}><X size={16} /></button></div><div className="privacy-banner"><ShieldCheck size={14} /><span>当前对话不会读取或上传画布中的文件</span></div><div className="chat-body"><div className="ai-welcome"><span><Sparkles size={18} /></span><strong>想快速聊点什么？</strong><p>我可以帮你梳理思路、解释概念或生成计划。</p></div>{sent && <><div className="chat-user">帮我规划一次用户访谈</div><div className="chat-assistant">可以。建议先围绕“现有资料组织方式、寻找答案的阻碍、对引用可信度的判断”设计 3 组核心问题，再用具体任务验证。</div></>}<div className="prompt-chips"><button onClick={() => setSent(true)}>梳理产品想法</button><button onClick={() => setSent(true)}>生成工作计划</button><button onClick={() => setSent(true)}>解释一个概念</button></div></div><form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="chat-compose"><textarea placeholder="输入问题，Shift + Enter 换行" /><button><ArrowUp size={15} /></button></form></aside>;
}

function AnswerDialog({ question, onClose, onSave }: { question: string; onClose: () => void; onSave: () => void }) {
  return <div className="modal-backdrop"><section className="answer-dialog"><div className="dialog-head"><div><span className="dialog-icon"><Sparkles size={17} /></span><div><strong>基于 20 份资料的回答</strong><small>已检索 8 条关键证据</small></div></div><button onClick={onClose}><X size={17} /></button></div><div className="question-echo">{question}</div><article className="answer-content"><h2>核心发现</h2><p>多份访谈共同表明，用户真正缺少的不是另一个文件管理器，而是把分散资料转化为<strong>可验证结论</strong>的工作方式。受访者最常遇到的阻碍是：资料之间的关系不可见，以及 AI 回答无法快速回到原文。</p><p>竞品普遍解决了“收集”和“搜索”，但较少把<strong>证据、结论与下一步任务</strong>放在同一个连续工作流中。这构成了哇塞-超级桌面最清晰的差异化机会。</p><div className="inline-citations"><button>[1] 用户访谈汇总 · 第 4 页 <ExternalLink size={11} /></button><button>[2] 竞品分析报告 ·「知识工作流」 <ExternalLink size={11} /></button><button>[3] 研究笔记 ·「可信度」 <ExternalLink size={11} /></button></div><h3>建议优先验证</h3><ol><li>用户能否在 10 秒内从结论回到支撑它的原文；</li><li>把结论直接转为任务，是否能减少信息在工具之间丢失；</li><li>画布关系能否帮助用户理解 AI 实际读取了哪些资料。</li></ol></article><footer className="dialog-footer"><span><ShieldCheck size={13} />仅发送了 8 条证据块，完整文件留在本机</span><div><button className="copy-button"><Copy size={14} />复制</button><button onClick={onSave} className="primary-action"><MessageSquareText size={14} />保存为结论节点</button></div></footer></section></div>;
}

function FolderCanvas({ onClose, onNotify }: { onClose: () => void; onNotify: (message: string) => void }) {
  return <div className="modal-backdrop"><section className="folder-dialog"><div className="folder-top"><div><span className="node-icon amber"><Folder size={18} /></span><div><strong>用户访谈</strong><small>文件夹画布 · 12 个文件</small></div></div><div><button onClick={() => onNotify('已整理文件夹画布')}><Minimize2 size={14} />一键整理</button><button onClick={onClose}><X size={16} /></button></div></div><div className="folder-toolbar"><button>重命名</button><button>批量重命名</button><button>复制</button><button>移出到主画布</button><span /><button><ExternalLink size={13} />系统中打开</button></div><div className="folder-surface"><svg viewBox="0 0 900 480"><path d="M220 140 C310 140 320 230 405 230"/><path d="M220 330 C310 330 320 250 405 250"/><path d="M585 240 C655 240 670 240 735 240"/></svg><MiniFile className="f1" name="访谈 01 · 林悦" type="DOCX · 已索引"/><MiniFile className="f2" name="访谈 02 · 周舟" type="PDF · 已索引"/><div className="folder-kb"><Database size={17}/><strong>访谈洞察</strong><span>12 个来源</span></div><div className="folder-ai"><Bot size={17}/><strong>主题归纳</strong><span>AI 分析</span></div><div className="folder-drop">拖到此处移出到主画布</div></div></section></div>;
}
function MiniFile({ className, name, type }: { className: string; name: string; type: string }) { return <div className={`mini-file ${className}`}><FileText size={18}/><div><strong>{name}</strong><span>{type}</span></div></div>; }

function SettingsDialog({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return <div className="modal-backdrop"><section className="settings-dialog"><div className="dialog-head"><div><span className="dialog-icon"><Settings size={17}/></span><div><strong>AI 与 API 设置</strong><small>模型密钥经系统安全存储加密</small></div></div><button onClick={onClose}><X size={17}/></button></div><div className="settings-grid"><nav><button className="active">模型服务</button><button>资料问答</button><button>AI 快问</button><button>隐私与数据</button></nav><div className="settings-form"><label>服务商<select defaultValue="openai"><option value="openai">OpenAI</option><option>DeepSeek</option><option>其他兼容服务</option></select></label><label>API 地址<input defaultValue="https://api.openai.com/v1" /></label><label>模型<input defaultValue="gpt-5.4" /></label><label>API Key<div className="key-field"><input type="password" defaultValue="sk-prototype-key"/><ShieldCheck size={14}/></div><small>已保存：sk-••••••••9R2x。留空不会覆盖。</small></label><button className="test-button"><Zap size={14}/>测试连接</button><div className="security-note"><ShieldCheck size={16}/><div><strong>密钥不会进入画布或浏览器存储</strong><span>正式桌面应用使用系统 safeStorage 加密，只在主进程调用模型。</span></div></div></div></div><footer className="dialog-footer"><span>更改只影响之后发起的请求</span><div><button onClick={onClose} className="copy-button">取消</button><button onClick={onSave} className="primary-action">保存设置</button></div></footer></section></div>;
}
