// ============================================================
// src/lib/rule-engine/evaluator.ts — 개별 체크 함수 (순수 함수만)
// 절대 규칙: 판정은 여기서만 한다. LLM에게 판정 시키지 않는다.
// 동일 입력 + 동일 규칙팩 버전 → 항상 동일 결과 (결정론)
// ============================================================
import type { DiagnosisCase, Field, Rule, Verdict } from '@/types';
import { SOURCE_KO } from './sufficiency';

const won = (n: number) => `${(n / 100000000).toFixed(1)}억원`;

/** usedValues에 붙일 출처 꼬리표. 출처는 Field에 이미 들어있으니 문자열로 지어내지 않는다. */
const tag = (f: Field<unknown>) => `(${SOURCE_KO[f.source]})`;

/** 개별 체크 함수의 반환: verdict + 사람이 읽는 근거 */
export interface CheckOutcome {
  verdict: Verdict;
  reason: string;
  usedValues: string[];
  nextAction: string;
}

export type Checker = (c: DiagnosisCase, params: Rule['params']) => CheckOutcome;

// ---------- 1층: KB 상품요건 체크 ----------

const checkAge: Checker = (c, p) => {
  const min = Number(p?.min ?? 19);
  const max = p?.max === undefined ? undefined : Number(p.max);
  const age = c.applicant.age.value;
  const ok = age >= min && (max === undefined || age <= max);
  const range = max === undefined ? `만 ${min}세 이상` : `만 ${min}~${max}세`;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: `신고 연령 ${age}세 — 요건 ${range}`,
    usedValues: [`연령 ${age}세 ${tag(c.applicant.age)}`],
    nextAction: ok ? '' : '연령 요건이 다른 KB 상품을 확인하세요.',
  };
};

const HH_LABEL = { YES: '세대주', NO: '세대원', PLANNED: '세대주 예정자' } as const;

const checkHouseholder: Checker = (c, p) => {
  const h = c.applicant.householdHead.value;
  const used = [`세대주 상태: ${HH_LABEL[h]} ${tag(c.applicant.householdHead)}`];
  if (h === 'YES') {
    return {
      verdict: 'NO_PUBLIC_CONFLICT_FOUND',
      reason: '세대주로 신고됨',
      usedValues: used,
      nextAction: '',
    };
  }
  if (h === 'PLANNED') {
    if (p?.plannedAllowed === true) {
      return {
        verdict: 'NO_PUBLIC_CONFLICT_FOUND',
        reason:
          '세대주 예정자 — 실행일로부터 1개월 이내 세대주가 되는 조건으로 공개요건과 충돌 없음',
        usedValues: used,
        nextAction: '대출 실행 후 1개월 이내 전입·세대주 등록 일정을 확인하세요.',
      };
    }
    // 세대주 예정자 인정 여부는 실행일 기준 확인이 필요하다. 미충족으로 단정하지 않는다.
    return {
      verdict: 'OFFICIAL_REVIEW_REQUIRED',
      reason:
        '세대주 예정자로 신고됨 — 대출 실행일 기준 세대주 요건 충족 여부는 공식 심사에서 확인',
      usedValues: used,
      nextAction: '전입신고·세대분리 예정일을 KB 상담 시 알리고 세대주 인정 여부를 확인하세요.',
    };
  }
  return {
    verdict: 'PUBLIC_REQUIREMENT_UNMET',
    reason: '세대원으로 신고됨 — 세대주 요건과 충돌',
    usedValues: used,
    nextAction: '전입신고·세대분리로 세대주가 될 수 있는지 확인하세요.',
  };
};

const checkHomeCount: Checker = (c, p) => {
  const max = Number(p?.maxHomes ?? 1);
  const n = c.applicant.homeCount.value;
  const ok = n <= max;
  const label = n === 2 ? '2채 이상' : `${n}채`;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: `신고 주택보유 ${label} — 요건 ${max}주택 이내 (KB 상품 기준. HUG 보증은 무주택 요건일 수 있음)`,
    usedValues: [`주택보유 ${label} ${tag(c.applicant.homeCount)}`],
    nextAction: ok ? '' : '보유 주택 처분 계획이 있다면 KB 상담 시 함께 문의하세요.',
  };
};

const checkIncomeCap: Checker = (c, p) => {
  const band = c.applicant.incomeBand.value;
  // '모름'은 F04(진단자료 충분성 검사)에서 이미 걸러진다. 규칙팩을 단독 실행하는 경우를 위한 방어.
  if (band === 'UNKNOWN') {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '부부합산 연소득을 "모름"으로 선택 — 소득 상한 요건 판정 불가',
      usedValues: [`소득구간: 모름 ${tag(c.applicant.incomeBand)}`],
      nextAction: '원천징수영수증·소득금액증명으로 부부합산 소득을 확인 후 다시 진단하세요.',
    };
  }
  // capBand 이하 구간만 충족으로 본다 (예시: UNDER_50M)
  const order = ['UNDER_50M', 'B50_60M', 'B60_70M', 'OVER_70M'];
  const cap = String(p?.capBand ?? 'UNDER_50M');
  const ok = order.indexOf(band) <= order.indexOf(cap);
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: `신고 소득구간 기준 상한 요건 ${ok ? '이내' : '초과'} (한도 계산 아님, O/X 판정)`,
    usedValues: [`소득구간 ${band} ${tag(c.applicant.incomeBand)}`],
    nextAction: ok ? '' : '소득 상한이 다른 상품(예: 청년 맞춤형 7천)을 확인하세요.',
  };
};

const checkExistingLoan: Checker = (c) => {
  const f = c.applicant.existingJeonseLoan;
  const label = { NONE: '없음', HAS_ONE: '1건', HAS_MULTIPLE: '2건 이상' }[f.value];
  if (f.value === 'NONE') {
    return {
      verdict: 'NO_PUBLIC_CONFLICT_FOUND',
      reason: '기존 전세자금대출 없음으로 신고됨',
      usedValues: [`기존 전세대출: ${label} ${tag(f)}`],
      nextAction: '',
    };
  }
  return {
    verdict: 'OFFICIAL_REVIEW_REQUIRED',
    reason: `기존 전세자금대출 ${label} 보유 — 중복 이용 제한 해당 여부는 기관 전산 조회가 필요`,
    usedValues: [`기존 전세대출: ${label} ${tag(f)}`],
    nextAction: '기존 대출의 상환·승계 계획을 정리해 KB 상담 시 중복 제한 해당 여부를 확인하세요.',
  };
};

const checkBrokered: Checker = (c) => {
  const ok = c.contract.brokered.value;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: ok ? '공인중개사 중개 계약 예정' : '직거래로 신고됨 — 중개 계약 요건과 충돌',
    usedValues: [`중개 여부: ${ok ? '중개' : '직거래'} ${tag(c.contract.brokered)}`],
    nextAction: ok ? '' : '직거래 시 취급 가능 여부를 KB에 확인하거나 중개 계약을 검토하세요.',
  };
};

const checkIncomeEvidence: Checker = (c) => {
  const ok = c.applicant.incomeType.value !== 'NO_INCOME';
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: ok
      ? '근로·사업소득 증빙 가능 유형으로 신고됨'
      : '무소득으로 신고됨 — 소득증빙 필수 요건과 충돌',
    usedValues: [`소득 유형 ${c.applicant.incomeType.value} ${tag(c.applicant.incomeType)}`],
    nextAction: ok ? '' : '무소득자를 허용하는 다른 상품 경로를 확인하세요.',
  };
};

const checkTermRange: Checker = (c, p) => {
  const min = Number(p?.minMonths ?? 12);
  const max = Number(p?.maxMonths ?? 24);
  const term = c.contract.termMonths.value;
  const ok = term >= min && term <= max;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: `계약기간 ${term}개월 — 요건 ${min}~${max}개월`,
    usedValues: [`계약기간 ${term}개월 ${tag(c.contract.termMonths)}`],
    nextAction: ok ? '' : `계약기간을 ${min}~${max}개월 범위로 조정 가능한지 확인하세요.`,
  };
};

// ---------- 2층: HUG 보증요건 체크 ----------

const checkTermMin: Checker = (c, p) => {
  const min = Number(p?.minMonths ?? 12);
  const t = c.contract.termMonths.value;
  const ok = t >= min;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: `계약기간 ${t}개월 — 요건 ${min}개월 이상`,
    usedValues: [`계약기간 ${t}개월 ${tag(c.contract.termMonths)}`],
    nextAction: ok ? '' : '계약기간을 1년 이상으로 조정 가능한지 임대인과 협의하세요.',
  };
};

const checkDepositCap: Checker = (c, p) => {
  const region = c.property.region;
  const deposit = c.contract.deposit;
  if (!region) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '주소에서 수도권/비수도권을 판별하지 못함',
      usedValues: [`주소 ${c.property.address?.value || '(미입력)'}`],
      nextAction: '도로명 주소를 정확히 입력해 주세요.',
    };
  }
  const cap = region.value === 'CAPITAL' ? Number(p?.capitalCap) : Number(p?.nonCapitalCap);
  const ok = deposit.value <= cap;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: `보증금 ${won(deposit.value)} — ${region.value === 'CAPITAL' ? '수도권' : '비수도권'} 한도 ${won(cap)}`,
    usedValues: [`보증금 ${won(deposit.value)} ${tag(deposit)}`, `지역 구분 ${tag(region)}`],
    nextAction: ok ? '' : '보증금이 한도를 초과합니다. 다른 매물 또는 다른 경로를 검토하세요.',
  };
};

const checkNotIllegalBuilding: Checker = (c) => {
  const f = c.property.isIllegalBuilding;
  if (f === undefined) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '위반건축물 표시는 건축HUB 공개 API에 제공되지 않아 판정 불가',
      usedValues: [],
      nextAction:
        '정부24 또는 세움터에서 건축물대장을 열람해 상단의 위반건축물 표시 여부를 확인하세요.',
    };
  }
  const ok = f.value === false;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: ok ? '건축물대장상 위반건축물 표시 없음' : '건축물대장에 위반건축물 표시 있음',
    usedValues: [`위반건축물 여부 ${tag(f)}`],
    nextAction: ok ? '' : '위반건축물은 HUG 보증이 어렵습니다. 계약 보류를 권고합니다.',
  };
};

const checkNoRightsViolation: Checker = (c) => {
  const f = c.registry?.hasRightsViolation;
  if (f === undefined) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '등기사항전부증명서 미제출 — 권리침해 여부 판정 불가',
      usedValues: [],
      nextAction: '등기부를 발급받아 업로드하고 추출 결과를 확인해 주세요.',
    };
  }
  const ok = f.value === false;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: ok ? '확인된 압류·가압류·경매·가처분·가등기 없음' : '등기부상 권리침해 기재 확인됨',
    usedValues: [`권리침해 여부 ${tag(f)}`],
    nextAction: ok ? '' : '권리침해가 있는 매물은 보증이 어렵습니다. 계약 보류를 권고합니다.',
  };
};

const checkExistingLeaseholdTransfer: Checker = (c) => {
  const f = c.registry?.existingLeaseholdRights;
  if (f === undefined) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '등기사항전부증명서에서 현재 유효한 전세권 설정 여부를 확인하지 못함',
      usedValues: [],
      nextAction: '등기부를 업로드하고 말소되지 않은 전세권이 있는지 확인해 주세요.',
    };
  }
  if (f.value === false) {
    return {
      verdict: 'NO_PUBLIC_CONFLICT_FOUND',
      reason: '등기부에서 현재 유효한 전세권 설정이 확인되지 않음',
      usedValues: [`현재 전세권 없음 ${tag(f)}`],
      nextAction: '',
    };
  }
  return {
    verdict: 'PRE_GUARANTEE_ACTION_REQUIRED',
    reason: '등기부에서 현재 유효한 전세권 설정이 확인됨 — HUG 공시상 공사로 이전하거나 말소 필요',
    usedValues: [`현재 전세권 있음 ${tag(f)}`],
    nextAction: 'HUG 보증 실행 전에 설정된 전세권을 HUG로 이전하거나 말소할 절차와 시점을 KB에 확인하세요.',
  };
};

const checkOwnerMatch: Checker = (c) => {
  const f = c.registry?.ownerMatch;
  if (f === undefined) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '등기부상 소유자와 계약 임대인이 같은 사람인지 확인되지 않음',
      usedValues: [],
      nextAction: '등기부를 업로드해 소유자명과 임대인명이 같은지 확인해 주세요.',
    };
  }
  const used = [`소유자·임대인 일치 여부 ${tag(f)}`];
  if (f.value === 'MATCHED') {
    return {
      verdict: 'NO_PUBLIC_CONFLICT_FOUND',
      reason: '등기부 소유자와 계약 임대인이 일치함',
      usedValues: used,
      nextAction: '',
    };
  }
  if (f.value === 'MATCHED_PARTIAL_CO_OWNERS') {
    return {
      verdict: 'OFFICIAL_REVIEW_REQUIRED',
      reason:
        '등기부상 공동소유자 중 일부만 계약 임대인으로 기재됨 — 나머지 공유자의 동의 여부는 계약 전 확인 필요',
      usedValues: used,
      nextAction:
        '계약에 참여하지 않은 다른 공유자의 동의서·위임장을 임대인에게 요청하고 KB 상담 시 제시하세요.',
    };
  }
  return {
    verdict: 'PUBLIC_REQUIREMENT_UNMET',
    reason: '등기부 소유자와 계약 임대인이 일치하지 않음',
    usedValues: used,
    nextAction:
      '임대인이 실제 소유자가 맞는지, 대리 계약이라면 위임장·인감증명서를 갖추었는지 확인하세요.',
  };
};

const checkIndividualOwner: Checker = (c) => {
  const ownerType = c.registry?.ownerType;
  if (!ownerType) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '등기부상 임대인 유형이 확인되지 않아 법인 임대인 제외 요건을 판정할 수 없음',
      usedValues: [],
      nextAction: '등기부를 업로드하고 소유자 유형을 확인해 주세요.',
    };
  }
  const ok = ownerType.value === 'INDIVIDUAL';
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: ok
      ? '등기부상 소유자가 개인으로 확인됨'
      : '등기부상 소유자가 법인 — HUG 취급 제외 요건과 충돌',
    usedValues: [
      `소유자 유형 ${ownerType.value === 'INDIVIDUAL' ? '개인' : '법인'} (고객확인문서)`,
    ],
    nextAction: ok
      ? ''
      : '법인 임대인 목적물은 HUG 전세금안심대출보증 취급 가능 여부를 KB에 확인하세요.',
  };
};

const checkOtherHouseholdOccupancy: Checker = (c) => {
  if (c.property.propertyType?.value === 'DETACHED') {
    return {
      verdict: 'NO_PUBLIC_CONFLICT_FOUND',
      reason: '단독·다중·다가구는 타 세대 전입 없음 요건의 예외 주택유형',
      usedValues: [`주택 유형 ${c.property.propertyTypeLabel ?? '단독·다가구'} (건축HUB)`],
      nextAction: '',
    };
  }
  return {
    verdict: 'OFFICIAL_REVIEW_REQUIRED',
    reason: '전입세대확인서상 타 세대 전입 여부는 제출 서류를 바탕으로 HUG 공식 심사에서 확인 필요',
    usedValues: [],
    nextAction: '전입세대확인서를 확보해 타 세대 전입 여부를 KB 상담 시 확인하세요.',
  };
};

const checkSeniorLienRatio: Checker = (c) => {
  const lien = c.registry?.seniorLienTotal;
  if (lien === undefined) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '선순위채권(근저당 설정액) 정보 없음',
      usedValues: [],
      nextAction: '등기부를 업로드해 근저당 설정액을 확인해 주세요.',
    };
  }
  // 비율 계산에는 공식 시세 기반 주택가격이 필요 → 계약 전 확보 불가
  return {
    verdict: 'OFFICIAL_REVIEW_REQUIRED',
    reason: `선순위채권 ${won(lien.value)} 확인됨. 비율 판정에는 공식 시세 기반 주택가격이 필요 — 공개정보로 판단 불가`,
    usedValues: [`선순위채권 ${won(lien.value)} ${tag(lien)}`],
    nextAction: 'KB 상담 시 주택가격 산정 기준과 선순위 비율 충족 여부를 문의하세요.',
  };
};

/** 다가구 여부에 따른 선순위 임차보증금 경고 (HUG 담보인정 다가구 80% / 그 외 90%) */
const checkMultiFamilyRisk: Checker = (c) => {
  const t = c.property.propertyTypeLabel;
  const type = c.property.propertyType;
  const multi = c.property.isMultiFamily;
  if (!type || !multi) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '주택 유형 미확인 — 담보인정비율 기준(다가구 80% / 그 외 90%)을 특정할 수 없음',
      usedValues: [],
      nextAction: '주소를 확인해 건축물대장 조회를 다시 시도하세요.',
    };
  }
  if (multi.value) {
    return {
      verdict: 'OFFICIAL_REVIEW_REQUIRED',
      reason: '다가구주택 — 다른 임차인의 선순위 보증금 총액이 담보인정 한도에 포함되나 계약 전 확인 불가',
      usedValues: [`주택 유형 ${t} ${tag(type)}`],
      nextAction: '임대인에게 선순위 임차보증금 총액 확인서를 요청하고, KB 상담 시 함께 제시하세요.',
    };
  }
  return {
    verdict: 'NO_PUBLIC_CONFLICT_FOUND',
    reason: `${t} — 호별 개별 등기로 선순위 임차보증금 합산 대상 아님`,
    usedValues: [`주택 유형 ${t} ${tag(type)}`],
    nextAction: '',
  };
};

/** 공통 규칙: 대상 주택유형 (아파트·연립·다세대·주거용 오피스텔) */
const checkEligiblePropertyType: Checker = (c, p) => {
  const f = c.property.propertyType;
  if (!f) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '건축물대장 조회 실패 — 대상 주택유형 판정 불가',
      usedValues: [],
      nextAction: '주소를 확인해 건축물대장 조회를 다시 시도하세요.',
    };
  }
  const label = c.property.propertyTypeLabel ?? f.value;
  const allowed = String(p?.allowed ?? 'APT,MULTI_UNIT,DETACHED,OFFICETEL').split(',');
  if (!allowed.includes(f.value)) {
    return {
      verdict: 'PUBLIC_REQUIREMENT_UNMET',
      reason: `${label} — 이 경로의 보증 대상 주택유형에 해당하지 않음`,
      usedValues: [`주택 유형 ${label} ${tag(f)}`],
      nextAction: '보증 대상 주택유형의 매물을 검토하세요.',
    };
  }
  if (f.value === 'OFFICETEL') {
    return {
      verdict: 'OFFICIAL_REVIEW_REQUIRED',
      reason: '오피스텔 — 주거용으로 인정되는지는 실제 사용 용도 확인이 필요',
      usedValues: [`주택 유형 ${label} ${tag(f)}`],
      nextAction: '주거용 오피스텔로 인정받을 수 있는지 KB 상담 시 확인하세요.',
    };
  }
  return {
    verdict: 'NO_PUBLIC_CONFLICT_FOUND',
    reason: `${label} — 보증 대상 주택유형에 해당`,
    usedValues: [`주택 유형 ${label} ${tag(f)}`],
    nextAction: '',
  };
};

// ---------- 기관별 주택가액·선순위 임계값 ----------

function missingHousingPrice(
  c: DiagnosisCase,
  institution: string,
  formula: string,
): CheckOutcome | null {
  if (c.property.housingPrice) return null;
  return {
    verdict: 'OFFICIAL_REVIEW_REQUIRED',
    reason: `${institution} 산정 순위에 따른 공식 주택가격이 없어 ${formula} 계산 불가`,
    usedValues: [],
    nextAction: 'KB 상담 시 보증기관이 적용하는 주택가격과 비율 충족 여부를 확인하세요.',
  };
}

const checkHugCollateralRatio: Checker = (c, p) => {
  const collateralPct = Number(p?.collateralPct ?? 90);
  const seniorLienPct = Number(p?.seniorLienPct ?? 60);
  const multiFamilySeniorPct = Number(p?.multiFamilySeniorPct ?? 80);
  const noPrice = missingHousingPrice(
    c,
    'HUG',
    `주택가액 ${collateralPct}%·선순위 ${seniorLienPct}%·다가구 ${multiFamilySeniorPct}%`,
  );
  if (noPrice) return noPrice;
  const price = c.property.housingPrice!.value;
  const houseValue = price * (collateralPct / 100);
  const lien = c.registry?.seniorLienTotal;
  if (!lien) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '선순위채권 설정액이 없어 HUG 담보인정비율 계산 불가',
      usedValues: [`공식 주택가격 ${won(price)}`],
      nextAction: '등기부를 업로드해 근저당 설정액을 확인하세요.',
    };
  }

  const detached = c.property.propertyType?.value === 'DETACHED';
  const seniorLease = c.registry?.seniorLeaseDepositTotal;
  if (detached && !seniorLease) {
    return {
      verdict: 'OFFICIAL_REVIEW_REQUIRED',
      reason:
        '단독·다가구는 다른 세입자의 선순위보증금까지 필요해 HUG 80% 요건을 계약 전 공개정보만으로 계산할 수 없음',
      usedValues: [`공식 주택가격 ${won(price)}`, `선순위 근저당 ${won(lien.value)}`],
      nextAction: '임대인에게 선순위 임차보증금 확인서를 요청해 HUG 심사에 제출하세요.',
    };
  }

  const otherSenior = seniorLease?.value ?? 0;
  const securedTotal = c.contract.deposit.value + lien.value + otherSenior;
  const withinCollateral = securedTotal <= houseValue;
  const withinSeniorLien = lien.value <= houseValue * (seniorLienPct / 100);
  const withinDetachedSenior =
    !detached || lien.value + otherSenior <= houseValue * (multiFamilySeniorPct / 100);
  const ok = withinCollateral && withinSeniorLien && withinDetachedSenior;
  const exceeded: string[] = [];
  if (!withinCollateral) exceeded.push(`보증금+선순위 ${collateralPct}%`);
  if (!withinSeniorLien) exceeded.push(`근저당 주택가액의 ${seniorLienPct}%`);
  if (!withinDetachedSenior)
    exceeded.push(`단독·다가구 선순위 주택가액의 ${multiFamilySeniorPct}%`);
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: ok
      ? detached
        ? `보증금+선순위 ${collateralPct}%·근저당 ${seniorLienPct}%·단독/다가구 선순위 ${multiFamilySeniorPct}% 요건 충족`
        : `보증금+선순위 ${collateralPct}% 및 근저당 ${seniorLienPct}% 요건 충족`
      : `${exceeded.join('·')} 한도 초과`,
    usedValues: [
      `보증금 ${won(c.contract.deposit.value)} ${tag(c.contract.deposit)}`,
      `선순위 근저당 ${won(lien.value)}`,
      `공식 주택가격 ${won(price)}`,
      `HUG 주택가액 ${won(houseValue)}`,
    ],
    nextAction: ok ? '' : 'HUG 보증 한도를 초과하므로 계약 조건이나 다른 매물을 검토하세요.',
  };
};

const checkHugInterestBurden: Checker = (_c, p) => {
  const max = Number(p?.interestBurdenPct ?? 40);
  return {
    verdict: 'OFFICIAL_REVIEW_REQUIRED',
    reason: `연간 인정소득 대비 연간 이자비용 ${max}% 이내 여부는 인정소득·부채·예정 대출조건을 이용한 HUG 공식 산식이 필요`,
    usedValues: [],
    nextAction: 'KB 상담 시 HUG 인정소득과 연간 이자비용 산정 결과를 확인하세요.',
  };
};

const checkHfSeniorRatio: Checker = (c) => {
  const noPrice = missingHousingPrice(c, 'HF', '선순위채권 80%+근저당 60% 또는 선순위채권 60%');
  if (noPrice) return noPrice;
  const price = c.property.housingPrice!.value;
  const houseValue = price * 0.9;
  const lien = c.registry?.seniorLienTotal;
  if (!lien) {
    return {
      verdict: 'MISSING_INFORMATION',
      reason: '선순위근저당 설정액이 없어 HF 선순위 비율 계산 불가',
      usedValues: [`공식 주택가격 ${won(price)}`],
      nextAction: '등기부를 업로드해 근저당 설정액을 확인하세요.',
    };
  }

  const detached = c.property.propertyType?.value === 'DETACHED';
  const seniorLease = c.registry?.seniorLeaseDepositTotal;
  if (detached && !seniorLease) {
    return {
      verdict: 'OFFICIAL_REVIEW_REQUIRED',
      reason:
        '단독·다가구는 선순위 임차보증금까지 합산해야 HF 80%+60% 동시충족 여부를 계산할 수 있음',
      usedValues: [`주택가액(주택가격×90%) ${won(houseValue)}`, `선순위 근저당 ${won(lien.value)}`],
      nextAction: '임대인에게 선순위 임차보증금 확인서를 요청해 HF 심사에 제출하세요.',
    };
  }

  const seniorTotal = lien.value + (seniorLease?.value ?? 0);
  const ok = detached
    ? seniorTotal <= houseValue * 0.8 && lien.value <= houseValue * 0.6
    : seniorTotal <= houseValue * 0.6;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: detached
      ? `단독·다가구 선순위총액 80% + 근저당 60% 동시요건 ${ok ? '충족' : '초과'}`
      : `선순위채권총액 ${won(seniorTotal)} — 주택가액의 60% ${ok ? '이내' : '초과'}`,
    usedValues: [`주택가액(주택가격×90%) ${won(houseValue)}`, `선순위 근저당 ${won(lien.value)}`],
    nextAction: ok ? '' : 'HF 선순위채권 기준을 초과하므로 계약 보류 후 KB에 확인하세요.',
  };
};

const checkSgiSeniorRatio: Checker = (c) => {
  const lien = c.registry?.seniorLienTotal;
  return {
    verdict: 'OFFICIAL_REVIEW_REQUIRED',
    reason:
      'SGI는 선순위 설정액과 실제 전세대출금 합계가 시세의 80% 이내인지 심사하며, 신청 대출금·SGI 인정 시세가 필요함',
    usedValues: lien ? [`선순위 근저당 ${won(lien.value)} (고객확인문서)`] : [],
    nextAction: 'KB 상담 시 희망 대출금과 SGI 인정 시세를 기준으로 80% 요건을 확인하세요.',
  };
};

// ---------- 고정 판정 ----------

const alwaysPostContract: Checker = () => ({
  verdict: 'POST_CONTRACT_REQUIREMENT',
  reason: '계약 체결 및 계약금 지급 후에 충족되는 요건',
  usedValues: [],
  nextAction: '계약 시 계약금 지급 증빙(이체확인증 등)을 보관하세요.',
});

const alwaysOfficialReview: Checker = () => ({
  verdict: 'OFFICIAL_REVIEW_REQUIRED',
  reason: '기관 내부정보 또는 공식 시세가 필요해 공개정보로 판단 불가',
  usedValues: [],
  nextAction: 'KB·보증기관 공식 심사에서 확인됩니다.',
});

// ---------- 레지스트리 ----------

export const CHECKERS: Record<string, Checker> = {
  checkAge,
  checkHouseholder,
  checkHomeCount,
  checkIncomeCap,
  checkIncomeEvidence,
  checkBrokered,
  checkExistingLoan,
  checkEligiblePropertyType,
  checkTermMin,
  checkTermRange,
  checkDepositCap,
  checkNotIllegalBuilding,
  checkMultiFamilyRisk,
  checkNoRightsViolation,
  checkExistingLeaseholdTransfer,
  checkOwnerMatch,
  checkIndividualOwner,
  checkOtherHouseholdOccupancy,
  checkSeniorLienRatio,
  checkHugCollateralRatio,
  checkHugInterestBurden,
  checkHfSeniorRatio,
  checkSgiSeniorRatio,
  alwaysPostContract,
  alwaysOfficialReview,
};
