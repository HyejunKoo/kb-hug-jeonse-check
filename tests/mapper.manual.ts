// 매퍼 수동 테스트: npx tsx --tsconfig tsconfig.json tests/mapper.manual.ts
import { pickTitleItem, resolveHousingType, jusoToLotCode } from '@/features/building/mapper';

// 케이스 1: 집합대장 다세대 (현대아트빌라)
const c1 = [{ regstrKindCdNm:'표제부', regstrGbCdNm:'집합', mainAtchGbCdNm:'주건축물', mainPurpsCdNm:'공동주택', hhldCnt:18, fmlyCnt:0 }];
// 케이스 2: 일반대장 다가구 (가상)
const c2 = [{ regstrKindCdNm:'일반건축물', regstrGbCdNm:'일반', mainAtchGbCdNm:'주건축물', mainPurpsCdNm:'단독주택', hhldCnt:0, fmlyCnt:7 }];
// 케이스 3: 일반대장 순수 단독
const c3 = [{ regstrKindCdNm:'일반건축물', regstrGbCdNm:'일반', mainAtchGbCdNm:'주건축물', mainPurpsCdNm:'단독주택', hhldCnt:0, fmlyCnt:0 }];
// 케이스 4: 부속건축물만 (월드컵경기장 실응답)
const c4 = [
  { regstrKindCdNm:'일반건축물', regstrGbCdNm:'일반', mainAtchGbCdNm:'부속건축물', mainPurpsCdNm:'운동시설', hhldCnt:0, fmlyCnt:0 },
  { regstrKindCdNm:'일반건축물', regstrGbCdNm:'일반', mainAtchGbCdNm:'부속건축물', mainPurpsCdNm:'운동시설', hhldCnt:0, fmlyCnt:0 },
];

for (const [name, items] of [['집합 다세대',c1],['일반 다가구',c2],['일반 단독',c3],['부속만(경기장)',c4]] as const) {
  const r = pickTitleItem(items as any);
  const h = r.item ? resolveHousingType(r.item) : undefined;
  console.log(name.padEnd(16), '→', h ? `${h.code} / ${h.label}${h.isMultiFamily ? " (다가구)" : ""}` : `item없음 (ambiguous=${r.ambiguous}, onlyAnnex=${r.onlyAnnex})`);
  if (h) console.log(' '.repeat(19), h.basis);
}
console.log('\nlotCode:', JSON.stringify(jusoToLotCode({ admCd:'1144012500', lnbrMnnm:'515', lnbrSlno:'0', mtYn:'0' } as any)));
