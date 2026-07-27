// 공용 입력 컴포넌트 (1번 담당)
'use client';

export function Row({ label, hint, required, children }: {
  label: React.ReactNode; hint?: React.ReactNode; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="ml-1 align-top text-kb-600">*</span>}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** 두 값 중 하나를 고르는 세그먼트 컨트롤 */
export function Toggle({ value, onChange, yes, no }: {
  value: boolean; onChange: (v: boolean) => void; yes: string; no: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1" role="group">
      {[{ v: true, t: yes }, { v: false, t: no }].map((o) => (
        <button
          key={o.t}
          type="button"
          aria-pressed={value === o.v}
          className={`rounded-md px-4 py-1.5 text-sm transition ${
            value === o.v
              ? 'bg-white font-bold text-slate-900 shadow-sm'
              : 'font-medium text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => onChange(o.v)}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function Nav({ onPrev, onNext, nextLabel = '다음', disabled }: {
  onPrev?: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
      {onPrev ? (
        <button className="btn-sub" onClick={onPrev} disabled={disabled}>
          <span aria-hidden>←</span> 이전
        </button>
      ) : (
        <span />
      )}
      <button className="btn-main min-w-[7.5rem]" onClick={onNext} disabled={disabled}>
        {nextLabel}
      </button>
    </div>
  );
}
