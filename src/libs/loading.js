// src/libs/loading.js

const W = typeof window !== 'undefined' ? window : undefined;
const EVT = 'app:loading-change';

const state = {
  count: 0,
  visible: false,
  showDelayMs: 120,
  minVisibleMs: 400,
  _showT: null,
  _hideT: null,
  _lastShowAt: 0,
};

function emit() {
  if (!W) return;
  W.__appLoading = { count: state.count, visible: state.visible };
  W.dispatchEvent(new CustomEvent(EVT, { detail: W.__appLoading }));
}

function scheduleShow() {
  clearTimeout(state._showT);
  clearTimeout(state._hideT);
  state._showT = setTimeout(() => {
    state.visible = true;
    state._lastShowAt = Date.now();
    emit();
  }, state.showDelayMs);
}

function scheduleHide() {
  const elapsed = Date.now() - (state._lastShowAt || 0);
  const wait = Math.max(state.minVisibleMs - elapsed, 0);
  clearTimeout(state._showT);
  clearTimeout(state._hideT);
  state._hideT = setTimeout(() => {
    state.visible = false;
    emit();
  }, wait);
}

export function loadingStart() {
  state.count += 1;
  if (state.count === 1) scheduleShow();
  emit();
}

export function loadingEnd() {
  if (state.count > 0) state.count -= 1;
  if (state.count === 0) scheduleHide();
  emit();
}

async function resilientFetch(input, init, { timeoutMs = 12000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(t);
      return res;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      // Retry on network-ish errors only
      const name = err?.name || '';
      const isTransient = name === 'AbortError' || name === 'TypeError' || String(err?.message || '').includes('Failed to fetch');
      if (attempt < retries && isTransient) {
        // exponential-ish backoff 200ms, 400ms, ...
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function trackedFetch(input, init) {
  loadingStart();
  try {
    return await resilientFetch(input, init);
  } finally {
    loadingEnd();
  }
}

export async function callWithLoader(promiseLike) {
  loadingStart();
  try {
    return await promiseLike;
  } finally {
    loadingEnd();
  }
}

export const LOADING_EVENT = EVT;