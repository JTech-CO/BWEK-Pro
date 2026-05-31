import './styles/xp.css';
import type { EncId } from './lib/codecs';
import type { Direction, Preset } from './lib/convert';
import type { RestoreGuess } from './lib/detect';

type Lib = typeof import('./lib');

// 무거운 변환 엔진(codepage 포함)은 동적 import 로 지연 로드된다.
let L: Lib;

// ---------- DOM 참조 ----------
function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 요소를 찾을 수 없습니다`);
  return el as T;
}

const input = byId<HTMLTextAreaElement>('input');
const output = byId<HTMLTextAreaElement>('output');
const presetSel = byId<HTMLSelectElement>('preset');
const customRow = byId<HTMLDivElement>('customRow');
const fromEnc = byId<HTMLSelectElement>('fromEnc');
const toEnc = byId<HTMLSelectElement>('toEnc');
const forwardBtn = byId<HTMLButtonElement>('forwardBtn');
const backwardBtn = byId<HTMLButtonElement>('backwardBtn');
const smartBtn = byId<HTMLButtonElement>('smartBtn');
const swapBtn = byId<HTMLButtonElement>('swapBtn');
const resetBtn = byId<HTMLButtonElement>('resetBtn');
const closeBtn = byId<HTMLButtonElement>('closeBtn');
const copyBtn = byId<HTMLButtonElement>('copyBtn');
const shareBtn = byId<HTMLButtonElement>('shareBtn');
const noteEl = byId<HTMLParagraphElement>('note');
const inCount = byId<HTMLSpanElement>('inCount');
const outCount = byId<HTMLSpanElement>('outCount');
const statusEl = byId<HTMLSpanElement>('status');
const guessesEl = byId<HTMLDivElement>('guesses');
const guessList = byId<HTMLUListElement>('guessList');

// ---------- 상태 ----------
let presetId = 'ja-bwek';
let direction: Direction = 'forward';
let customFrom: EncId = 'shift_jis';
let customTo: EncId = 'cp949';
let flashTimer: number | undefined;

// ---------- 핵심 동작 ----------
function currentPreset(): Preset {
  if (presetId === L.CUSTOM_PRESET_ID) return L.customPreset(customFrom, customTo);
  return L.getPreset(presetId) ?? L.getPreset(L.DEFAULT_PRESET_ID)!;
}

function convert(): void {
  output.value = L.applyPreset(input.value, currentPreset(), direction);
  updateCounts();
}

function updateCounts(): void {
  const chars = [...input.value].length;
  const bytes = new TextEncoder().encode(input.value).length;
  inCount.textContent = `${chars.toLocaleString()}자 · ${bytes.toLocaleString()}바이트`;
  outCount.textContent = `${[...output.value].length.toLocaleString()}자`;
}

function syncButtons(): void {
  const p = currentPreset();
  forwardBtn.textContent = p.forwardLabel;
  backwardBtn.textContent = p.backwardLabel;
  forwardBtn.setAttribute('aria-pressed', String(direction === 'forward'));
  backwardBtn.setAttribute('aria-pressed', String(direction === 'backward'));
  forwardBtn.classList.toggle('active', direction === 'forward');
  backwardBtn.classList.toggle('active', direction === 'backward');
  noteEl.textContent = p.note ?? '';
}

function setDirection(dir: Direction): void {
  direction = dir;
  syncButtons();
  convert();
  hideGuesses();
}

function onPresetChange(): void {
  presetId = presetSel.value;
  customRow.hidden = presetId !== L.CUSTOM_PRESET_ID;
  syncButtons();
  convert();
}

function onCustomChange(): void {
  if (L.isEncId(fromEnc.value)) customFrom = fromEnc.value;
  if (L.isEncId(toEnc.value)) customTo = toEnc.value;
  syncButtons();
  convert();
}

function doSwap(): void {
  if (!input.value && !output.value) return;
  input.value = output.value;
  direction = direction === 'forward' ? 'backward' : 'forward';
  syncButtons();
  convert();
  hideGuesses();
  flash('입력과 결과를 맞바꿨습니다');
}

function doReset(): void {
  input.value = '';
  output.value = '';
  hideGuesses();
  updateCounts();
  flash('지웠습니다');
  input.focus();
}

function doShare(): void {
  const url = L.buildShareUrl({
    q: input.value,
    p: presetId,
    d: direction,
    from: customFrom,
    to: customTo,
  });
  void copyText(url, '공유 링크가 복사되었습니다');
}

async function copyText(text: string, okMsg: string): Promise<void> {
  if (!text) {
    flash('복사할 내용이 없습니다');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    flash(okMsg);
  } catch {
    output.focus();
    output.select();
    flash('Ctrl+C 로 복사하세요');
  }
}

// ---------- 스마트 복원 ----------
function runSmart(): void {
  renderGuesses(L.smartRestore(input.value));
}

function renderGuesses(list: RestoreGuess[]): void {
  guessList.replaceChildren();

  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'guess empty';
    li.textContent = '복원 후보를 찾지 못했습니다. 변환 종류를 직접 선택해 보세요.';
    guessList.append(li);
    guessesEl.hidden = false;
    return;
  }

  for (const g of list) {
    const li = document.createElement('li');
    li.className = 'guess';

    const head = document.createElement('div');
    head.className = 'guess-head';

    const label = document.createElement('span');
    label.className = 'guess-label';
    label.textContent = g.label;

    const conf = document.createElement('span');
    conf.className = 'guess-conf';
    conf.textContent = `신뢰도 ${g.confidence}%`;

    head.append(label, conf);

    const preview = document.createElement('div');
    preview.className = 'guess-preview';
    preview.textContent = g.result.length > 140 ? `${g.result.slice(0, 140)}…` : g.result;

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'xp-btn small';
    apply.textContent = '이 결과 적용';
    apply.addEventListener('click', () => applyGuess(g));

    li.append(head, preview, apply);
    guessList.append(li);
  }
  guessesEl.hidden = false;
}

function applyGuess(g: RestoreGuess): void {
  presetId = L.CUSTOM_PRESET_ID;
  presetSel.value = L.CUSTOM_PRESET_ID;
  customFrom = g.from;
  customTo = g.to;
  fromEnc.value = g.from;
  toEnc.value = g.to;
  customRow.hidden = false;
  direction = 'forward';
  syncButtons();
  convert();
  hideGuesses();
  flash('복원 결과를 적용했습니다');
  output.focus();
}

function hideGuesses(): void {
  guessesEl.hidden = true;
  guessList.replaceChildren();
}

// ---------- 유틸 ----------
function flash(msg: string): void {
  statusEl.textContent = msg;
  if (flashTimer) clearTimeout(flashTimer);
  if (msg) flashTimer = window.setTimeout(() => (statusEl.textContent = ''), 2800);
}

function debounce(fn: () => void, ms: number): () => void {
  let t: number | undefined;
  return () => {
    if (t) clearTimeout(t);
    t = window.setTimeout(fn, ms);
  };
}

// ---------- 셀렉트 채우기 ----------
function populatePresetSelect(): void {
  for (const p of L.PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    presetSel.append(opt);
  }
  const custom = document.createElement('option');
  custom.value = L.CUSTOM_PRESET_ID;
  custom.textContent = '사용자 지정 (인코딩 직접 선택)';
  presetSel.append(custom);
}

function populateEncodingSelect(sel: HTMLSelectElement): void {
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const e of L.ENCODINGS) {
    let group = groups.get(e.group);
    if (!group) {
      group = document.createElement('optgroup');
      group.label = e.group;
      groups.set(e.group, group);
      sel.append(group);
    }
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.label;
    group.append(opt);
  }
}

// ---------- 이벤트 ----------
function wireEvents(): void {
  const live = debounce(convert, 120);
  input.addEventListener('input', () => {
    updateCounts();
    hideGuesses();
    live();
  });
  presetSel.addEventListener('change', onPresetChange);
  fromEnc.addEventListener('change', onCustomChange);
  toEnc.addEventListener('change', onCustomChange);
  forwardBtn.addEventListener('click', () => setDirection('forward'));
  backwardBtn.addEventListener('click', () => setDirection('backward'));
  smartBtn.addEventListener('click', runSmart);
  swapBtn.addEventListener('click', doSwap);
  resetBtn.addEventListener('click', doReset);
  closeBtn.addEventListener('click', doReset);
  copyBtn.addEventListener('click', () => void copyText(output.value, '결과가 복사되었습니다'));
  shareBtn.addEventListener('click', doShare);
}

// ---------- 시작 ----------
async function init(): Promise<void> {
  L = await import('./lib');

  presetId = L.DEFAULT_PRESET_ID;
  populatePresetSelect();
  populateEncodingSelect(fromEnc);
  populateEncodingSelect(toEnc);

  const saved = L.readHash();
  if (saved) {
    if (saved.q != null) input.value = saved.q;
    if (saved.p) presetId = saved.p;
    if (saved.d) direction = saved.d;
    if (saved.from) customFrom = saved.from;
    if (saved.to) customTo = saved.to;
  }

  presetSel.value = presetId;
  fromEnc.value = customFrom;
  toEnc.value = customTo;
  customRow.hidden = presetId !== L.CUSTOM_PRESET_ID;

  wireEvents();
  syncButtons();
  convert();
}

void init();
