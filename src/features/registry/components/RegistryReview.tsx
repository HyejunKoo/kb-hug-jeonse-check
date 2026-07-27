'use client';
// src/features/registry/components/RegistryReview.tsx — 등기부 OCR 추출 → 고객 확인 (F03/F04, 2번 담당)
// 흐름: 파일 업로드 → /api/ocr 로 "추출 후보"만 받음 → 고객이 화면에서 확인·수정 →
//       확인 완료 시에만 RegistryInfo(USER_CONFIRMED_DOCUMENT)를 만들어 상위로 전달한다.
// 절대 규칙: 소유자 실명(ownerNameCandidate)과 임대인명은 이 컴포넌트 밖으로 나가지 않는다.
import { useRef, useState } from 'react';
import type { OcrErrorResponse, OcrFieldStatus, OcrResponse, RegistryInfo, RegistryOcrDraft } from '@/types';
import { Row, Toggle } from '@/features/intake/components/fields';

type YesNoUnknown = 'YES' | 'NO' | 'UNKNOWN';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const OCR_ERROR_KO: Record<string, string> = {
  OCR_NOT_CONFIGURED: 'OCR 연동이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.',
  INVALID_FILE: '파일을 확인해 주세요. (PDF·JPG·PNG, 10MB 이하)',
  INVALID_REGISTRY_DOCUMENT: '등기사항전부증명서로 확인되지 않는 문서입니다. 등기소 발급 문서인지 확인해 주세요.',
  OCR_PROVIDER_FAILED: 'OCR 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  RATE_LIMITED: 'OCR 요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
};

const STATUS_BADGE: Record<OcrFieldStatus, string> = {
  EXTRACTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOW_CONFIDENCE: 'bg-amber-50 text-amber-700 border-amber-200',
  MISSING: 'bg-slate-100 text-slate-600 border-slate-300',
};
const STATUS_LABEL: Record<OcrFieldStatus, string> = {
  EXTRACTED: '자동 인식',
  LOW_CONFIDENCE: '신뢰도 낮음 · 직접 확인',
  MISSING: '인식 안 됨 · 직접 입력',
};

function StatusBadge({ status }: { status?: OcrFieldStatus }) {
  if (!status) return null;
  return <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>;
}

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`;
}

/** 공백·법인 표기를 제거해 느슨하게 비교 (표시용 힌트일 뿐, 최종 판단은 고객이 한다) */
function normalizeName(s: string): string {
  return s.replace(/\s+/g, '').replace(/(주식회사|㈜|유한회사)/g, '');
}

export function RegistryReview({ onConfirmed }: { onConfirmed: (registry: RegistryInfo | undefined) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<RegistryOcrDraft | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // 고객 확인/수정 상태
  const [landlordName, setLandlordName] = useState('');
  const [ownerType, setOwnerType] = useState<'INDIVIDUAL' | 'CORPORATION' | 'UNKNOWN'>('UNKNOWN');
  const [ownerMatch, setOwnerMatch] = useState<YesNoUnknown>('UNKNOWN');
  const [rightsViolation, setRightsViolation] = useState<YesNoUnknown>('UNKNOWN');
  const [lienKnown, setLienKnown] = useState(false);
  const [lienAmount, setLienAmount] = useState('');

  /** 확인되지 않은 상태로 되돌아갈 때는 항상 부모의 확정값도 함께 지운다 — 이전 확인값이 그대로 판정에 남는 것을 막기 위함 */
  function clearConfirmed() {
    setConfirmed(false);
    onConfirmed(undefined);
  }

  function resetAll() {
    setFileMeta(null);
    setDraft(null);
    setError('');
    setLandlordName('');
    setOwnerType('UNKNOWN');
    setOwnerMatch('UNKNOWN');
    setRightsViolation('UNKNOWN');
    setLienKnown(false);
    setLienAmount('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearConfirmed();
  }

  async function onUpload(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setError('파일 크기는 10MB 이하여야 합니다.');
      return;
    }
    setFileMeta({ name: file.name, size: file.size });
    setUploading(true);
    setError('');
    setDraft(null);
    clearConfirmed();
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ocr', { method: 'POST', body: form });
      if (!res.ok) {
        const err = (await res.json()) as OcrErrorResponse;
        setError(OCR_ERROR_KO[err.code] ?? err.error ?? 'OCR 처리에 실패했습니다.');
        return;
      }
      const data = (await res.json()) as OcrResponse;
      setDraft(data.draft);
      setOwnerType(data.draft.ownerType?.status !== 'MISSING' && data.draft.ownerType?.value ? data.draft.ownerType.value : 'UNKNOWN');
      setRightsViolation(
        data.draft.hasRightsViolation?.status !== 'MISSING' && data.draft.hasRightsViolation?.value !== undefined
          ? (data.draft.hasRightsViolation.value ? 'YES' : 'NO')
          : 'UNKNOWN',
      );
      if (data.draft.seniorLienTotal?.status !== 'MISSING' && data.draft.seniorLienTotal?.value !== undefined) {
        setLienKnown(true);
        setLienAmount(String(data.draft.seniorLienTotal.value));
      } else {
        setLienKnown(false);
        setLienAmount('');
      }
    } catch {
      setError('OCR 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  }

  function buildRegistry(): RegistryInfo {
    const registry: RegistryInfo = {};
    if (ownerType !== 'UNKNOWN') {
      registry.ownerType = { value: ownerType, source: 'USER_CONFIRMED_DOCUMENT' };
    }
    if (ownerMatch !== 'UNKNOWN') {
      registry.ownerMatch = { value: ownerMatch === 'YES', source: 'USER_CONFIRMED_DOCUMENT' };
    }
    if (rightsViolation !== 'UNKNOWN') {
      registry.hasRightsViolation = { value: rightsViolation === 'YES', source: 'USER_CONFIRMED_DOCUMENT' };
    }
    if (lienKnown && lienAmount.trim() !== '' && Number.isFinite(Number(lienAmount))) {
      registry.seniorLienTotal = { value: Number(lienAmount), source: 'USER_CONFIRMED_DOCUMENT' };
    }
    if (draft?.issuedDate) registry.issuedDate = draft.issuedDate;
    return registry;
  }

  function onConfirmClick() {
    setConfirmed(true);
    onConfirmed(buildRegistry());
  }

  const nameHint =
    draft?.ownerNameCandidate?.value && landlordName.trim()
      ? normalizeName(draft.ownerNameCandidate.value) === normalizeName(landlordName)
        ? '입력하신 임대인명과 등기부상 소유자 표기가 비슷합니다. 직접 대조 후 선택해 주세요.'
        : '입력하신 임대인명과 등기부상 소유자 표기가 달라 보입니다. 직접 대조 후 선택해 주세요.'
      : '';

  return (
    <div className="space-y-3">
      <Row
        label="등기사항전부증명서 (PDF·JPG·PNG)"
        hint="등기소에서 발급한 문서(PDF) 또는 촬영·스캔 이미지를 업로드하면 소유자 유형·근저당·권리침해 후보를 추출합니다. 추출 결과는 반드시 원본과 대조해 확인해 주세요."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="inp flex-1"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
          {(fileMeta || draft || error) && (
            <button type="button" className="btn-ghost shrink-0" onClick={resetAll} disabled={uploading}>
              초기화
            </button>
          )}
        </div>
        {fileMeta && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            {fileMeta.name} · {formatBytes(fileMeta.size)}
          </p>
        )}
      </Row>

      {uploading && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-kb-500" aria-hidden />
          OCR 추출 중입니다… 최대 1분 정도 걸릴 수 있어요.
        </p>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}

      {draft && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-900">
              추출 후보 — 원본 문서와 대조 후 아래에서 직접 확인·선택해 주세요
            </p>
            {confirmed && (
              <button type="button" className="btn-ghost shrink-0 text-[12px]" onClick={clearConfirmed}>
                수정하기
              </button>
            )}
          </div>

          <fieldset disabled={confirmed} className="space-y-4 disabled:opacity-60">
            <Row
              label={
                <span className="inline-flex items-center gap-2">
                  등기부상 소유자 유형 <StatusBadge status={draft.ownerType?.status} />
                </span>
              }
            >
              <select className="inp" value={ownerType} onChange={(e) => setOwnerType(e.target.value as typeof ownerType)}>
                <option value="UNKNOWN">모름 / 확인 안 됨</option>
                <option value="INDIVIDUAL">개인</option>
                <option value="CORPORATION">법인</option>
              </select>
            </Row>

            <Row
              label="계약 임대인 성명 (비교용 · 저장되지 않음)"
              hint="여기 입력한 값과 등기부 원문 소유자명은 서버에 전송·저장되지 않고 이 화면 비교에만 사용됩니다."
            >
              <input
                className="inp"
                value={landlordName}
                onChange={(e) => setLandlordName(e.target.value)}
                placeholder="계약서상 임대인 성명"
              />
            </Row>

            {nameHint && <p className="text-xs text-amber-700">{nameHint}</p>}

            <Row label="등기부 소유자와 계약 임대인이 동일인입니까?">
              <select className="inp" value={ownerMatch} onChange={(e) => setOwnerMatch(e.target.value as YesNoUnknown)}>
                <option value="UNKNOWN">모름 / 확인 안 됨</option>
                <option value="YES">예, 동일인입니다</option>
                <option value="NO">아니요, 다릅니다</option>
              </select>
            </Row>

            <Row
              label={
                <span className="inline-flex items-center gap-2">
                  선순위채권(근저당) 설정액 합계 <StatusBadge status={draft.seniorLienTotal?.status} />
                </span>
              }
              hint={draft.seniorLienTotal?.evidence ? `인식된 문구: ${draft.seniorLienTotal.evidence}` : undefined}
            >
              <div className="flex items-center gap-2">
                <Toggle value={lienKnown} onChange={setLienKnown} yes="금액 확인됨" no="모름" />
                {lienKnown && (
                  <input
                    type="number"
                    inputMode="numeric"
                    className="inp flex-1"
                    value={lienAmount}
                    onChange={(e) => setLienAmount(e.target.value)}
                    placeholder="원 단위"
                  />
                )}
              </div>
            </Row>

            <Row
              label={
                <span className="inline-flex items-center gap-2">
                  압류·가압류·경매·가처분·가등기 등 권리침해 <StatusBadge status={draft.hasRightsViolation?.status} />
                </span>
              }
              hint={draft.hasRightsViolation?.evidence ? `인식된 문구: ${draft.hasRightsViolation.evidence}` : undefined}
            >
              <select
                className="inp"
                value={rightsViolation}
                onChange={(e) => setRightsViolation(e.target.value as YesNoUnknown)}
              >
                <option value="UNKNOWN">모름 / 확인 안 됨</option>
                <option value="NO">없음</option>
                <option value="YES">있음</option>
              </select>
            </Row>
          </fieldset>

          {!confirmed && (
            <div className="border-t border-slate-100 pt-3">
              <button className="btn-main" onClick={onConfirmClick}>
                확인 완료 — 판정에 반영
              </button>
            </div>
          )}
        </div>
      )}

      {confirmed && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
          ✓ 등기부 확인 내용이 반영되었습니다. 값을 바꾸려면 위 &lsquo;수정하기&rsquo;를 눌러주세요.
        </p>
      )}
    </div>
  );
}
