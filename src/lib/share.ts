import { type EncId, isEncId } from './codecs';
import { type Direction } from './convert';

/**
 * 현재 상태를 URL 해시(#s=...)에 base64url-JSON 으로 담아 공유 가능한 링크를 만든다.
 * 서버가 없으므로 모든 상태는 클라이언트 URL 안에서만 오간다.
 */
export interface ShareState {
  q: string; // 입력 텍스트
  p: string; // 프리셋 id ('custom' 포함)
  d: Direction; // 방향
  from?: EncId; // custom 일 때만
  to?: EncId; // custom 일 때만
}

export function readHash(): Partial<ShareState> | null {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const raw = params.get('s');
  if (!raw) return null;
  try {
    const obj = JSON.parse(b64urlDecode(raw)) as Partial<ShareState>;
    return sanitize(obj);
  } catch {
    return null;
  }
}

export function buildShareUrl(state: ShareState): string {
  const payload = b64urlEncode(JSON.stringify(trimState(state)));
  const base = `${location.origin}${location.pathname}`;
  return `${base}#s=${payload}`;
}

/** 히스토리를 더럽히지 않고 현재 주소만 갱신한다. */
export function updateHash(state: ShareState): void {
  const payload = b64urlEncode(JSON.stringify(trimState(state)));
  history.replaceState(null, '', `#s=${payload}`);
}

function trimState(state: ShareState): ShareState {
  const out: ShareState = { q: state.q, p: state.p, d: state.d };
  if (state.p === 'custom') {
    out.from = state.from;
    out.to = state.to;
  }
  return out;
}

function sanitize(obj: Partial<ShareState>): Partial<ShareState> {
  const out: Partial<ShareState> = {};
  if (typeof obj.q === 'string') out.q = obj.q;
  if (typeof obj.p === 'string') out.p = obj.p;
  if (obj.d === 'forward' || obj.d === 'backward') out.d = obj.d;
  if (typeof obj.from === 'string' && isEncId(obj.from)) out.from = obj.from;
  if (typeof obj.to === 'string' && isEncId(obj.to)) out.to = obj.to;
  return out;
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
