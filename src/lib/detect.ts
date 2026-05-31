import { type EncId, reinterpret } from './codecs';

/**
 * 스마트 복원: 입력을 "깨진 글"로 보고, 자주 발생하는 인코딩 오독 조합을 모두 시도해
 * "가장 자연스러운 글"을 점수순으로 돌려준다.
 *
 * 각 후보 = reinterpret(input, from, to)
 *   from : 입력이 현재 잘못 표시되고 있는 인코딩
 *   to   : 되살리려는 원래 인코딩
 */

export interface RestoreGuess {
  from: EncId;
  to: EncId;
  label: string;
  result: string;
  /** 표시용 신뢰도 0~100 */
  confidence: number;
}

interface Candidate {
  from: EncId;
  to: EncId;
  label: string;
}

const CANDIDATES: readonly Candidate[] = [
  { from: 'cp949', to: 'shift_jis', label: '뷁어 → 일본어 (Shift-JIS)' },
  { from: 'cp949', to: 'gbk', label: '뷁어 → 중국어 간체 (GBK)' },
  { from: 'cp949', to: 'big5', label: '뷁어 → 중국어 번체 (Big5)' },
  { from: 'cp949', to: 'utf-8', label: 'CP949 깨짐 → UTF-8' },
  { from: 'shift_jis', to: 'cp949', label: '일본환경 깨짐 → 한국어 (CP949)' },
  { from: 'shift_jis', to: 'utf-8', label: 'Shift-JIS 깨짐 → UTF-8' },
  { from: 'latin1', to: 'utf-8', label: 'Ã 깨짐 → UTF-8 (Latin-1)' },
  { from: 'windows-1252', to: 'utf-8', label: 'Ã 깨짐 → UTF-8 (Windows-1252)' },
  { from: 'gbk', to: 'utf-8', label: 'GBK 깨짐 → UTF-8' },
  { from: 'big5', to: 'utf-8', label: 'Big5 깨짐 → UTF-8' },
  { from: 'euc-jp', to: 'cp949', label: 'EUC-JP → 한국어 (CP949)' },
];

const MAX_GUESSES = 5;

export function smartRestore(input: string): RestoreGuess[] {
  const text = input.trim();
  if (!text) return [];

  const seen = new Set<string>();
  const guesses: RestoreGuess[] = [];

  for (const c of CANDIDATES) {
    let result: string;
    try {
      result = reinterpret(input, c.from, c.to);
    } catch {
      continue;
    }
    // 변화 없음/중복 결과는 제외
    if (result === input || seen.has(result)) continue;

    const raw = naturalness(result);
    if (raw <= 0) continue; // 깨짐 신호가 더 강하면 후보에서 제외

    seen.add(result);
    guesses.push({
      from: c.from,
      to: c.to,
      label: c.label,
      result,
      confidence: Math.min(100, Math.round(raw * 100)),
    });
  }

  guesses.sort((a, b) => b.confidence - a.confidence);
  return guesses.slice(0, MAX_GUESSES);
}

/**
 * 텍스트의 "자연스러움"을 -∞~1 로 점수화한다.
 * 의미 있는 글자(한중일/한글/ASCII)는 가점, 대체문자·제어문자·PUA는 강한 감점.
 */
function naturalness(s: string): number {
  if (!s) return 0;
  let good = 0;
  let bad = 0;
  let subst = 0;
  let total = 0;

  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    total++;
    if (cp === 0x3f)
      subst++; // '?' = 우리 인코더가 표현 불가 글자에 넣는 치환 신호 → 실패 징후
    else if (isBad(cp)) bad++;
    else if (isMeaningful(cp)) good++;
  }
  if (total === 0) return 0;
  return (good - 3 * bad - 2 * subst) / total;
}

function isMeaningful(cp: number): boolean {
  return (
    (cp >= 0x20 && cp <= 0x7e) || // ASCII 인쇄 가능
    cp === 0x09 ||
    cp === 0x0a ||
    cp === 0x0d || // 탭/줄바꿈
    (cp >= 0x3000 && cp <= 0x303f) || // CJK 기호/구두점
    (cp >= 0x3040 && cp <= 0x309f) || // 히라가나
    (cp >= 0x30a0 && cp <= 0x30ff) || // 가타카나
    (cp >= 0x3130 && cp <= 0x318f) || // 한글 호환 자모
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK 확장 A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK 통합 한자
    (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 음절
    (cp >= 0xff01 && cp <= 0xffef) // 전각/반각 형태
  );
}

function isBad(cp: number): boolean {
  return (
    cp === 0xfffd || // 대체 문자
    (cp <= 0x08) ||
    cp === 0x0b ||
    cp === 0x0c ||
    (cp >= 0x0e && cp <= 0x1f) || // C0 제어문자
    cp === 0x7f || // DEL
    (cp >= 0x80 && cp <= 0x9f) || // C1 제어문자
    (cp >= 0xe000 && cp <= 0xf8ff) // 사용자 정의 영역(PUA)
  );
}
