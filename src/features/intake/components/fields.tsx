// 공용 입력 컴포넌트 (1번 담당)
'use client';

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function Toggle({ value, onChange, yes, no }: {
  value: boolean; onChange: (v: boolean) => void; yes: string; no: string;
}) {
  return (
    <div className="flex gap-2">
      {[{ v: true, t: yes }, { v: false, t: no }].map(o => (
        <button key={o.t} type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm ${value === o.v ? 'border-yellow-500 bg-yellow-50 font-semibold' : 'border-slate-200 text-slate-500'}`}
          onClick={() => onChange(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

export function Nav({ onPrev, onNext, nextLabel = '다음' }: {
  onPrev?: () => void; onNext: () => void; nextLabel?: string;
}) {
  return (
    <div className="flex justify-between pt-2">
      {onPrev ? <button className="btn-sub" onClick={onPrev}>이전</button> : <span />}
      <button className="btn-main" onClick={onNext}>{nextLabel}</button>
    </div>
  );
}
