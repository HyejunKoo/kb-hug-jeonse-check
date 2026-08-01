'use client';
// 저장된 진단 1건 삭제. 목록·상세 두 화면에서 함께 쓴다.
//   목록  → after='refresh' (그 자리에서 목록만 갱신)
//   상세  → after='redirect' (지운 페이지에 머무를 수 없으므로 목록으로)
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
  after?: 'redirect' | 'refresh';
  /** 목록 카드 안에 들어가는 작은 아이콘 버튼 */
  compact?: boolean;
  /** 무엇을 지우는지 확인 문구에 넣는다 (목록에서 카드가 여러 개일 때 필요) */
  label?: string;
}

export function DeleteCaseButton({ id, after = 'redirect', compact = false, label }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    const what = label ? `'${label}' 진단 결과` : '이 진단 결과';
    if (!window.confirm(`${what}를 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (after === 'redirect') router.push('/diagnosis/result');
        router.refresh();
      } else {
        const { error } = await res.json().catch(() => ({ error: '삭제에 실패했습니다.' }));
        window.alert(error ?? '삭제에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={onDelete}
        disabled={loading}
        aria-label={label ? `${label} 진단 삭제` : '진단 삭제'}
        title="삭제"
        className="shrink-0 rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"
      >
        {loading ? (
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
        ) : (
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M4 6h12M8 6V4.5A.5.5 0 0 1 8.5 4h3a.5.5 0 0 1 .5.5V6m1.5 0-.6 9a1 1 0 0 1-1 .95h-5.8a1 1 0 0 1-1-.95L5.5 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button type="button" className="btn-sub" onClick={onDelete} disabled={loading}>
      {loading ? '삭제 중…' : '이 진단 삭제'}
    </button>
  );
}
