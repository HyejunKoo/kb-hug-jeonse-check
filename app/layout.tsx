import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KB 전세 코파일럿',
  description: '계약금 지급 전, 공개요건 기준 사전점검',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
