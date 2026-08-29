import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '哇塞-超级桌面 · 无限知识画布',
  description: '把本地资料、知识、AI 结论与任务连接在同一张无限画布上。',
  openGraph: {
    title: '哇塞-超级桌面 · 无限知识画布',
    description: '让每个结论，都回到证据。',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: '哇塞-超级桌面无限知识画布' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '哇塞-超级桌面 · 无限知识画布',
    description: '让每个结论，都回到证据。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
