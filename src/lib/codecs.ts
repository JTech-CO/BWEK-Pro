/**
 * 뷁어(모지바케) = 어떤 인코딩의 바이트를 다른 인코딩으로 잘못 읽어 글자가 깨지는 현상.
 * 모든 변환은 reinterpret(text, from, to) = decode(to, encode(from, text)) 한 줄이다.
 *
 * 디코딩은 브라우저 내장 TextDecoder 를 쓴다(euc-kr 라벨 = CP949/UHC 슈퍼셋).
 * 인코딩은 표준 API 가 UTF-8 만 지원하므로, 같은 인코딩의 TextDecoder 를 역으로
 * 훑어 "문자→바이트" 표를 런타임에 만들어 캐시한다 → 인코딩 데이터 무번들.
 */

export type EncId =
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'shift_jis'
  | 'euc-jp'
  | 'cp949'
  | 'gbk'
  | 'big5'
  | 'latin1'
  | 'windows-1252';

export interface EncodingInfo {
  id: EncId;
  label: string;
  /** UI 셀렉트의 optgroup 으로 쓰이는 언어 묶음 */
  group: string;
}

export const ENCODINGS: readonly EncodingInfo[] = [
  { id: 'utf-8', label: 'UTF-8', group: '유니코드' },
  { id: 'utf-16le', label: 'UTF-16 LE', group: '유니코드' },
  { id: 'utf-16be', label: 'UTF-16 BE', group: '유니코드' },
  { id: 'shift_jis', label: 'Shift-JIS · 일본어', group: '일본어' },
  { id: 'euc-jp', label: 'EUC-JP · 일본어', group: '일본어' },
  { id: 'cp949', label: 'CP949 / EUC-KR · 한국어', group: '한국어' },
  { id: 'gbk', label: 'GBK · 중국어 간체', group: '중국어' },
  { id: 'big5', label: 'Big5 · 중국어 번체', group: '중국어' },
  { id: 'latin1', label: 'Latin-1 (ISO-8859-1)', group: '서유럽' },
  { id: 'windows-1252', label: 'Windows-1252', group: '서유럽' },
] as const;

const LABEL_BY_ID = new Map<EncId, string>(ENCODINGS.map((e) => [e.id, e.label]));
const VALID_IDS = new Set<string>(ENCODINGS.map((e) => e.id));

/** TextDecoder 에 넘길 WHATWG 라벨 (latin1 은 내장 디코더를 쓰지 않음) */
const NATIVE_LABEL: Partial<Record<EncId, string>> = {
  'utf-8': 'utf-8',
  'utf-16le': 'utf-16le',
  'utf-16be': 'utf-16be',
  shift_jis: 'shift_jis',
  'euc-jp': 'euc-jp',
  cp949: 'euc-kr', // 브라우저의 euc-kr 디코더 = CP949 / UHC
  gbk: 'gbk',
  big5: 'big5',
  'windows-1252': 'windows-1252',
};

/** 멀티바이트(2바이트 선두 0x81~0xFE) 인코딩 */
const DBCS = new Set<EncId>(['shift_jis', 'euc-jp', 'cp949', 'gbk', 'big5']);

const decoderCache = new Map<EncId, TextDecoder>();
const encodeMapCache = new Map<EncId, Map<number, number[]>>();

export function isEncId(value: string): value is EncId {
  return VALID_IDS.has(value);
}

export function encodingLabel(id: EncId): string {
  return LABEL_BY_ID.get(id) ?? id;
}

function decoder(enc: EncId): TextDecoder {
  let d = decoderCache.get(enc);
  if (!d) {
    d = new TextDecoder(NATIVE_LABEL[enc] ?? 'utf-8');
    decoderCache.set(enc, d);
  }
  return d;
}

export function encode(enc: EncId, text: string): Uint8Array {
  switch (enc) {
    case 'utf-8':
      return new TextEncoder().encode(text);
    case 'utf-16le':
      return utf16Encode(text, true);
    case 'utf-16be':
      return utf16Encode(text, false);
    case 'latin1':
      return latin1Encode(text);
    default:
      return encodeViaMap(enc, text);
  }
}

export function decode(enc: EncId, bytes: Uint8Array): string {
  if (enc === 'latin1') {
    // 진짜 ISO-8859-1: 바이트 b → U+00b (브라우저 TextDecoder 는 latin1 을
    // windows-1252 로 취급하므로 직접 처리해 둘을 구분한다)
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
  return decoder(enc).decode(bytes);
}

export function reinterpret(text: string, from: EncId, to: EncId): string {
  if (!text) return '';
  return decode(to, encode(from, text));
}

// ---------- 내부 구현 ----------

function utf16Encode(text: string, littleEndian: boolean): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), littleEndian);
  }
  return out;
}

function latin1Encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[i] = c < 0x100 ? c : 0x3f; // 표현 불가 → '?'
  }
  return out;
}

function encodeViaMap(enc: EncId, text: string): Uint8Array {
  const map = encodeMap(enc);
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const bytes = map.get(cp);
    if (bytes) out.push(...bytes);
    else out.push(0x3f); // 표현 불가 → '?'
  }
  return Uint8Array.from(out);
}

function encodeMap(enc: EncId): Map<number, number[]> {
  let map = encodeMapCache.get(enc);
  if (map) return map;
  map = buildEncodeMap(enc);
  encodeMapCache.set(enc, map);
  return map;
}

/** 내장 디코더를 역으로 훑어 "코드포인트 → 바이트" 표를 만든다. */
function buildEncodeMap(enc: EncId): Map<number, number[]> {
  const d = decoder(enc);
  const map = new Map<number, number[]>();

  const one = new Uint8Array(1);
  for (let b = 0; b < 0x100; b++) {
    one[0] = b;
    const s = d.decode(one);
    if (s.length === 1) {
      const cp = s.codePointAt(0)!;
      if (cp !== 0xfffd && !map.has(cp)) map.set(cp, [b]);
    }
  }

  if (DBCS.has(enc)) {
    const two = new Uint8Array(2);
    for (let hi = 0x81; hi <= 0xfe; hi++) {
      two[0] = hi;
      for (let lo = 0; lo < 0x100; lo++) {
        two[1] = lo;
        const s = d.decode(two);
        // 올바른 2바이트 글자만 정확히 한 글자(대체문자 아님)로 디코딩된다
        if (s.length === 1) {
          const cp = s.codePointAt(0)!;
          if (cp !== 0xfffd && !map.has(cp)) map.set(cp, [hi, lo]);
        }
      }
    }
  }

  return map;
}
