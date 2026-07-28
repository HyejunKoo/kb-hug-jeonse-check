'use client';

import type { PropertyTypeCode } from '@/types';
import { Row } from './fields';

export interface GuaranteeRatioValues {
  housingPrice?: number;
  seniorLeaseDepositTotal?: number;
}

export function GuaranteeRatioInputs({
  propertyType,
  value,
  onChange,
}: {
  propertyType?: PropertyTypeCode;
  value: GuaranteeRatioValues;
  onChange: (next: GuaranteeRatioValues) => void;
}) {
  const update = (key: keyof GuaranteeRatioValues, raw: string) => {
    onChange({ ...value, [key]: raw === '' ? undefined : Number(raw) });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-xs font-bold text-slate-900">보증기관 비율 계산용 선택 정보</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          비워두면 HUG/HF 인정 주택가격이 필요한 항목은 &lsquo;공식 심사 필요&rsquo;로 표시됩니다.
        </p>
      </div>

      <Row
        label="공식 주택가격"
        hint="KB시세·한국부동산원 시세·공시가격 등 보증기관이 인정하는 공식 화면에서 직접 확인한 값만 원 단위로 입력하세요. 단순 호가·임대인 주장 금액은 입력하지 마세요."
      >
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="inp"
          value={value.housingPrice ?? ''}
          onChange={(event) => update('housingPrice', event.target.value)}
          placeholder="선택 입력 · 원 단위"
        />
      </Row>

      {propertyType === 'DETACHED' && (
        <Row
          label="다른 세입자의 선순위 임차보증금 합계"
          hint="임대인이 제공한 선순위 임차보증금 확인자료와 실제 점유관계를 확인한 경우에만 입력하세요. 확인하지 못했다면 비워두세요."
        >
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className="inp"
            value={value.seniorLeaseDepositTotal ?? ''}
            onChange={(event) => update('seniorLeaseDepositTotal', event.target.value)}
            placeholder="선택 입력 · 원 단위"
          />
        </Row>
      )}
    </div>
  );
}
