// F10 다음 행동 패널 — 판정 결과에서 파생된 액션만 보여준다. 새 판정을 만들지 않는다.
import type { ActionCategory, ActionPlan, ActionSeverity } from '@/types';
import { ACTION_CATEGORY_DESC, ACTION_CATEGORY_KO, groupActionItems } from '../action-plan';

const CATEGORY_TONE: Record<ActionCategory, string> = {
  CONTRACT_HOLD: 'border-red-200 bg-red-50 text-red-700',
  SUPPLEMENTAL_DOCUMENT: 'border-amber-200 bg-amber-50 text-amber-700',
  LANDLORD_CONFIRMATION: 'border-orange-200 bg-orange-50 text-orange-700',
  BROKER_CONFIRMATION: 'border-sky-200 bg-sky-50 text-sky-700',
  KB_QUESTION: 'border-kb-200 bg-kb-50 text-kb-800',
};

const SEVERITY_ACCENT: Record<ActionSeverity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-400',
  info: 'bg-slate-300',
};

export function ActionPlanPanel({ plan }: { plan: ActionPlan }) {
  const groups = groupActionItems(plan);

  return (
    <section className="card" id="action-plan">
      <div className="card-head">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          F10 · 다음 행동
        </p>
        <h2 className="mt-1.5 text-lg font-bold tracking-tight">계약 전에 무엇을 하면 되는가</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.headline}</p>
      </div>

      <div className="card-body space-y-5">
        {plan.contractHoldRecommended && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-relaxed text-red-800"
          >
            계약 보류 권고 · 아래 항목이 해소되기 전에는 계약금을 지급하지 마세요.
          </div>
        )}

        {groups.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            판정 결과에서 도출된 추가 행동이 없습니다. 판정 상세를 그대로 KB 상담에 가져가세요.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.category}>
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className={`badge ${CATEGORY_TONE[group.category]}`}>
                  {ACTION_CATEGORY_KO[group.category]}
                </span>
                <span className="text-xs text-slate-400">{group.items.length}개 항목</span>
              </div>
              <p className="mb-2.5 text-xs leading-relaxed text-slate-500">
                {ACTION_CATEGORY_DESC[group.category]}
              </p>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="relative overflow-hidden rounded-xl border border-slate-200 bg-white pl-1"
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-1 ${SEVERITY_ACCENT[item.severity]}`}
                      aria-hidden
                    />
                    <div className="px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.detail}</p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        근거 · {item.sourceRuleIds.join(', ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p className="border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
          위 항목은 판정 결과에서 그대로 옮겨온 것이며, 새로 만든 요건·수치가 아닙니다. 모든 항목이
          해소되어도 승인·보증서 발급을 의미하지 않습니다.
        </p>
      </div>
    </section>
  );
}
