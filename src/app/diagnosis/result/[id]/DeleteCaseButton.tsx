'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteCaseButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!window.confirm('이 진단 결과를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/diagnosis/result');
        router.refresh();
      } else {
        const { error } = await res.json().catch(() => ({ error: '삭제에 실패했습니다.' }));
        window.alert(error ?? '삭제에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="btn-sub" onClick={onDelete} disabled={loading}>
      {loading ? '삭제 중…' : '이 진단 삭제'}
    </button>
  );
}
