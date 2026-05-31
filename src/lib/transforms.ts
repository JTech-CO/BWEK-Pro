import { encode } from './codecs';

/**
 * 바이트 재해석(뷁어)과 달리, 텍스트 자체를 다루는 유니코드 변환 모음.
 * 각 함수는 순수 text → text 이며, 코드포인트 뷰어만 진단용 텍스트 표를 만든다.
 */

// ----- 유니코드 정규화 (한글 자소 결합/분리) -----
export const toNFC = (s: string): string => s.normalize('NFC');
export const toNFD = (s: string): string => s.normalize('NFD');

// ----- 전각 ↔ 반각 -----
// 전각 가타카나(탁점 합성 포함)를 반각으로 되돌리는 표는 NFKC 로 만들어 둔다.
const FULL_TO_HALF_KATA: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (let h = 0xff61; h <= 0xff9f; h++) {
    const half = String.fromCharCode(h);
    const full = half.normalize('NFKC');
    if (full !== half && !(full in map)) map[full] = half;
  }
  // ｶ + ﾞ → ガ 같은 탁점/반탁점 합성형
  for (let h = 0xff66; h <= 0xff9d; h++) {
    const base = String.fromCharCode(h);
    for (const mark of ['ﾞ', 'ﾟ']) {
      const full = (base + mark).normalize('NFKC');
      if (full.length === 1 && !(full in map)) map[full] = base + mark;
    }
  }
  return map;
})();

export function toHalfwidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/[゠-ヿ]/g, (c) => FULL_TO_HALF_KATA[c] ?? c);
}

export function toFullwidth(s: string): string {
  return s
    .replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
    .replace(/ /g, '　')
    .replace(/[｡-ﾟ]+/g, (m) => m.normalize('NFKC')); // 반각 가나 → 전각(탁점 합성)
}

// ----- 이스케이프 / 엔티티 / 퍼센트 -----
function fromCp(n: number): string {
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

export function escapeUnicode(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out += ch; // ASCII 는 그대로
    else if (cp > 0xffff) out += `\\u{${cp.toString(16).toUpperCase()}}`;
    else out += `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return out;
}

export function unescapeUnicode(s: string): string {
  return s
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => fromCp(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function encodeHtmlEntities(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === '&') out += '&amp;';
    else if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '"') out += '&quot;';
    else if (cp < 0x80) out += ch;
    else out += `&#x${cp.toString(16).toUpperCase()};`;
  }
  return out;
}

export function decodeHtmlEntities(s: string): string {
  // textarea 의 RCDATA 파싱으로 명명/숫자 엔티티를 모두 안전하게 디코딩(스크립트 실행 없음)
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

export function encodePercent(s: string): string {
  return encodeURIComponent(s);
}

export function decodePercent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    // 잘못된 %시퀀스가 섞여 있으면 유효한 부분만 디코딩
    return s.replace(/%[0-9a-fA-F]{2}/g, (m) => {
      try {
        return decodeURIComponent(m);
      } catch {
        return m;
      }
    });
  }
}

// ----- 코드포인트 · 바이트 뷰어 -----
export function inspect(s: string): string {
  if (!s) return '';
  const cps = [...s];
  const LIMIT = 300;
  const hex = (b: Uint8Array) =>
    [...b].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  const lines = cps.slice(0, LIMIT).map((ch) => {
    const cp = ch.codePointAt(0)!;
    const u = `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    const shown = cp < 0x20 || cp === 0x7f ? '·' : ch; // 제어문자는 가운뎃점
    return `${u} '${shown}'  UTF-8 ${hex(encode('utf-8', ch))}  CP949 ${hex(encode('cp949', ch))}  SJIS ${hex(encode('shift_jis', ch))}`;
  });

  let out = `총 ${cps.length}자 · 글자별 코드포인트와 인코딩 바이트\n\n${lines.join('\n')}`;
  if (cps.length > LIMIT) out += `\n\n… (${LIMIT}자까지만 표시)`;
  return out;
}
