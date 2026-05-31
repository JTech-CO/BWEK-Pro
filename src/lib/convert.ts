import { type EncId, encodingLabel, reinterpret } from './codecs';
import {
  toNFC,
  toNFD,
  toHalfwidth,
  toFullwidth,
  escapeUnicode,
  unescapeUnicode,
  encodeHtmlEntities,
  decodeHtmlEntities,
  encodePercent,
  decodePercent,
  inspect,
} from './transforms';

/**
 * 프리셋은 두 종류다.
 *  1) 인코딩 깨짐(reinterpret) — (원본 trueEnc, 잘못 읽힌 viewEnc) 한 쌍.
 *     forward = trueEnc→viewEnc(깨뜨림), backward = viewEnc→trueEnc(복원).
 *  2) 유니코드 변환(transform) — forward/backward 가 text→text 함수.
 * oneWay 프리셋(코드포인트 뷰어)은 backward 가 없고 한 방향만 동작한다.
 */
export interface Preset {
  id: string;
  group: string;
  label: string;
  forwardLabel: string;
  backwardLabel: string;
  note?: string;
  oneWay?: boolean;
  // 1) reinterpret 종류
  trueEnc?: EncId;
  viewEnc?: EncId;
  // 2) transform 종류
  forward?: (s: string) => string;
  backward?: (s: string) => string;
}

export type Direction = 'forward' | 'backward';

const G_BWEK = '인코딩 깨짐 (뷁어)';
const G_UNICODE = '유니코드 도구';

export const PRESETS: readonly Preset[] = [
  {
    id: 'ja-bwek',
    group: G_BWEK,
    label: '일본어 ⇄ 뷁어',
    trueEnc: 'shift_jis',
    viewEnc: 'cp949',
    forwardLabel: '일본어 → 뷁어',
    backwardLabel: '뷁어 → 일본어',
    note: '일본어(Shift-JIS) 바이트를 한국어(CP949)로 잘못 읽을 때 나오는 대표적인 뷁어입니다. 가나는 거의 완벽히 왕복되지만, 일부 한자는 Shift-JIS 하위 바이트가 CP949에 없어 복원되지 않을 수 있습니다(실제 뷁어도 동일).',
  },
  {
    id: 'ko-bwek',
    group: G_BWEK,
    label: '한국어 ⇄ 일본환경 깨짐',
    trueEnc: 'cp949',
    viewEnc: 'shift_jis',
    forwardLabel: '한국어 → 깨짐',
    backwardLabel: '깨짐 → 한국어',
    note: '한국어(CP949) 바이트를 일본어(Shift-JIS) 환경에서 읽었을 때의 깨짐입니다.',
  },
  {
    id: 'utf8-latin1',
    group: G_BWEK,
    label: 'UTF-8 ⇄ Ã 깨짐 (웹 고전)',
    trueEnc: 'utf-8',
    viewEnc: 'latin1',
    forwardLabel: 'UTF-8 → Ã 깨짐',
    backwardLabel: 'Ã 깨짐 → UTF-8',
    note: 'UTF-8 문서를 Latin-1(ISO-8859-1)로 읽을 때 생기는 Ã, Â, ì 류의 고전적인 웹 깨짐입니다.',
  },
  {
    id: 'utf8-cp949',
    group: G_BWEK,
    label: 'UTF-8 ⇄ CP949 파일 깨짐',
    trueEnc: 'utf-8',
    viewEnc: 'cp949',
    forwardLabel: 'UTF-8 → 깨짐',
    backwardLabel: '깨짐 → UTF-8',
    note: 'UTF-8로 저장된 한글 파일을 CP949(완성형)로 열었을 때 나오는 깨짐입니다.',
  },
  {
    id: 'gbk-bwek',
    group: G_BWEK,
    label: '중국어 GBK ⇄ 뷁어',
    trueEnc: 'gbk',
    viewEnc: 'cp949',
    forwardLabel: 'GBK → 뷁어',
    backwardLabel: '뷁어 → GBK',
    note: '중국어 간체(GBK) 바이트를 한국어(CP949)로 읽을 때의 깨짐입니다.',
  },
  {
    id: 'big5-bwek',
    group: G_BWEK,
    label: '중국어 Big5 ⇄ 뷁어',
    trueEnc: 'big5',
    viewEnc: 'cp949',
    forwardLabel: 'Big5 → 뷁어',
    backwardLabel: '뷁어 → Big5',
    note: '중국어 번체(Big5) 바이트를 한국어(CP949)로 읽을 때의 깨짐입니다.',
  },

  {
    id: 'nfc-nfd',
    group: G_UNICODE,
    label: '한글 자소결합 ⇄ 분리 (NFC/NFD)',
    forward: toNFC,
    backward: toNFD,
    forwardLabel: '자소 결합 (NFC)',
    backwardLabel: '자소 분리 (NFD)',
    note: '맥에서 만든 한글 파일명·텍스트가 자소 분리(NFD)되어 깨질 때 "자소 결합(NFC)"으로 복원합니다.',
  },
  {
    id: 'fullwidth',
    group: G_UNICODE,
    label: '전각 ⇄ 반각',
    forward: toHalfwidth,
    backward: toFullwidth,
    forwardLabel: '전각 → 반각',
    backwardLabel: '반각 → 전각',
    note: 'ＡＢＣ→ABC, ｱｲｳ→アイウ 등 전각/반각 형태를 상호 변환합니다(가타카나 탁점 합성 포함).',
  },
  {
    id: 'esc-unicode',
    group: G_UNICODE,
    label: '유니코드 이스케이프 \\u ⇄ 텍스트',
    forward: unescapeUnicode,
    backward: escapeUnicode,
    forwardLabel: '\\u → 텍스트',
    backwardLabel: '텍스트 → \\u',
    note: '\\uXXXX, \\u{XXXXX}, \\xXX 형태의 이스케이프를 실제 글자로 풀거나 되돌립니다.',
  },
  {
    id: 'esc-html',
    group: G_UNICODE,
    label: 'HTML 엔티티 ⇄ 텍스트',
    forward: decodeHtmlEntities,
    backward: encodeHtmlEntities,
    forwardLabel: '엔티티 → 텍스트',
    backwardLabel: '텍스트 → 엔티티',
    note: '&#44032;, &#xAC00;, &amp; 같은 HTML 엔티티를 글자로 풀거나 되돌립니다(명명 엔티티 포함).',
  },
  {
    id: 'esc-percent',
    group: G_UNICODE,
    label: '퍼센트(URL) 인코딩 ⇄ 텍스트',
    forward: decodePercent,
    backward: encodePercent,
    forwardLabel: '%XX → 텍스트',
    backwardLabel: '텍스트 → %XX',
    note: '%EC%95%88 같은 URL 퍼센트 인코딩을 글자로 풀거나 되돌립니다.',
  },
  {
    id: 'inspect',
    group: G_UNICODE,
    label: '코드포인트·바이트 뷰어',
    forward: inspect,
    backward: inspect,
    oneWay: true,
    forwardLabel: '코드포인트 분석',
    backwardLabel: '코드포인트 분석',
    note: '글자별 유니코드 코드포인트(U+…)와 UTF-8·CP949·Shift-JIS 바이트를 보여줍니다. 왜 깨지는지 확인할 때 유용합니다.',
  },
] as const;

export const DEFAULT_PRESET_ID = 'ja-bwek';
export const CUSTOM_PRESET_ID = 'custom';

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** 사용자 지정(임의 from→to) 프리셋을 만든다. */
export function customPreset(from: EncId, to: EncId): Preset {
  const fromLabel = shortLabel(from);
  const toLabel = shortLabel(to);
  return {
    id: CUSTOM_PRESET_ID,
    group: '사용자 지정',
    label: '사용자 지정',
    trueEnc: from,
    viewEnc: to,
    forwardLabel: `${fromLabel} → ${toLabel}`,
    backwardLabel: `${toLabel} → ${fromLabel}`,
    note: `${encodingLabel(from)} 바이트를 ${encodingLabel(to)}(으)로 다시 읽습니다.`,
  };
}

/** 프리셋과 방향에 따라 변환을 수행한다. */
export function applyPreset(text: string, p: Preset, dir: Direction): string {
  if (p.forward && p.backward) {
    return dir === 'forward' ? p.forward(text) : p.backward(text);
  }
  return dir === 'forward'
    ? reinterpret(text, p.trueEnc!, p.viewEnc!)
    : reinterpret(text, p.viewEnc!, p.trueEnc!);
}

/** "Shift-JIS · 일본어" 같은 라벨에서 앞부분만 떼어 짧게. */
function shortLabel(id: EncId): string {
  return encodingLabel(id).split(' · ')[0];
}
