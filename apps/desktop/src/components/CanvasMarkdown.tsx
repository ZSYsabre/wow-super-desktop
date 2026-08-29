import type { ReactNode } from 'react';

export function CanvasMarkdown({ text }: { text: string }) {
  return <div className="canvas-markdown">{text.replace(/\r\n/g, '\n').split('\n').map((line, index) => {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { const content = inline(heading[2], index); return heading[1].length === 1 ? <h1 key={index}>{content}</h1> : heading[1].length === 2 ? <h2 key={index}>{content}</h2> : <h3 key={index}>{content}</h3>; }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) return <div className="canvas-markdown-list" key={index}><b>•</b><span>{inline(bullet[1], index)}</span></div>;
    const ordered = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (ordered) return <div className="canvas-markdown-list" key={index}><b>{ordered[1]}.</b><span>{inline(ordered[2], index)}</span></div>;
    if (/^\s*---+\s*$/.test(line)) return <hr key={index}/>;
    if (!line.trim()) return <div className="canvas-markdown-gap" key={index}/>;
    return <p key={index}>{inline(line, index)}</p>;
  })}</div>;
}

function inline(text: string, lineKey: number): ReactNode[] {
  return text.split(/(\*\*.+?\*\*|`.+?`|\[\d+\])/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${lineKey}-${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={`${lineKey}-${index}`}>{part.slice(1, -1)}</code>;
    if (/^\[\d+\]$/.test(part)) return <mark key={`${lineKey}-${index}`}>{part}</mark>;
    return part;
  });
}
