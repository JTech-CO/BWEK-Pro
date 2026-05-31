import { type EncId, encodingLabel, reinterpret } from './codecs';

/**
 * 프리셋 = (원본 인코딩 trueEnc, 잘못 읽힌 인코딩 viewEnc) 한 쌍.
 *  - forward  : trueEnc -> viewEnc  (정상 글을 깨뜨림)
 *  - backward : viewEnc -> trueEnc  (깨진 글을 복원함)
 * 두 동작은 서로 역연산이다.
 */
export interface Preset {
  id: string;
  /** 셀렉터에 보이는 이름, 예: "일본어 ⇄ 뷁어" */
  label: string;
  trueEnc: EncId;
  viewEnc: EncId;
  /** forward(깨뜨리기) 버튼 라벨 */
  forwardLabel: string;
  /** backward(복원) 버튼 라벨 */
  backwardLabel: string;
  /** 변환 특성에 대한 안내 문구 */
  note?: string;
}

export type Direction = 'forward' | 'backward';

export const PRESETS: readonly Preset[] = [
  {
    id: 'ja-bwek',
    label: '일본어 ⇄ 뷁어',
    trueEnc: 'shift_jis',
    viewEnc: 'cp949',
    forwardLabel: '일본어 → 뷁어',
    backwardLabel: '뷁어 → 일본어',
    note: '일본어(Shift-JIS) 바이트를 한국어(CP949)로 잘못 읽을 때 나오는 대표적인 뷁어입니다. 가나는 거의 완벽히 왕복되지만, 일부 한자는 Shift-JIS 하위 바이트가 CP949에 없어 복원되지 않을 수 있습니다(실제 뷁어도 동일).',
  },
  {
    id: 'ko-bwek',
    label: '한국어 ⇄ 일본환경 깨짐',
    trueEnc: 'cp949',
    viewEnc: 'shift_jis',
    forwardLabel: '한국어 → 깨짐',
    backwardLabel: '깨짐 → 한국어',
    note: '한국어(CP949) 바이트를 일본어(Shift-JIS) 환경에서 읽었을 때의 깨짐입니다.',
  },
  {
    id: 'utf8-latin1',
    label: 'UTF-8 ⇄ Ã 깨짐 (웹 고전)',
    trueEnc: 'utf-8',
    viewEnc: 'latin1',
    forwardLabel: 'UTF-8 → Ã 깨짐',
    backwardLabel: 'Ã 깨짐 → UTF-8',
    note: 'UTF-8 문서를 Latin-1(ISO-8859-1)로 읽을 때 생기는 Ã, Â, ì 류의 고전적인 웹 깨짐입니다.',
  },
  {
    id: 'utf8-cp949',
    label: 'UTF-8 ⇄ CP949 파일 깨짐',
    trueEnc: 'utf-8',
    viewEnc: 'cp949',
    forwardLabel: 'UTF-8 → 깨짐',
    backwardLabel: '깨짐 → UTF-8',
    note: 'UTF-8로 저장된 한글 파일을 CP949(완성형)로 열었을 때 나오는 깨짐입니다.',
  },
  {
    id: 'gbk-bwek',
    label: '중국어 GBK ⇄ 뷁어',
    trueEnc: 'gbk',
    viewEnc: 'cp949',
    forwardLabel: 'GBK → 뷁어',
    backwardLabel: '뷁어 → GBK',
    note: '중국어 간체(GBK) 바이트를 한국어(CP949)로 읽을 때의 깨짐입니다.',
  },
  {
    id: 'big5-bwek',
    label: '중국어 Big5 ⇄ 뷁어',
    trueEnc: 'big5',
    viewEnc: 'cp949',
    forwardLabel: 'Big5 → 뷁어',
    backwardLabel: '뷁어 → Big5',
    note: '중국어 번체(Big5) 바이트를 한국어(CP949)로 읽을 때의 깨짐입니다.',
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
  return dir === 'forward'
    ? reinterpret(text, p.trueEnc, p.viewEnc)
    : reinterpret(text, p.viewEnc, p.trueEnc);
}

/** "Shift-JIS · 일본어" 같은 라벨에서 앞부분만 떼어 짧게. */
function shortLabel(id: EncId): string {
  return encodingLabel(id).split(' · ')[0];
}
