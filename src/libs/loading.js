// src/libs/loading.js

const W = typeof window !== 'undefined' ? window : undefined;
const EVT = 'app:loading-change';

// Supabase base URL (used to give auth endpoints a longer timeout/retry on mobile)
const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPA_AUTH_PREFIX = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/` : '';

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
  // Detect Supabase auth calls and give them more time + retries (helps Android mobile radios)
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const method = String(init?.method || 'GET').toUpperCase();
  const isAuth = SUPA_AUTH_PREFIX && url.startsWith(SUPA_AUTH_PREFIX);

  const localTimeout = isAuth && timeoutMs < 25000 ? 25000 : timeoutMs; // 25s for auth
  const localRetries = isAuth && retries < 3 ? 3 : retries;             // up to 3 tries for auth

  // Safe defaults for cross-origin API calls
  const baseInit = {
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    keepalive: method !== 'GET',
    ...init,
  };

  let lastErr;
  for (let attempt = 0; attempt <= localRetries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort('timeout'), localTimeout);
    try {
      const res = await fetch(input, { ...baseInit, signal: controller.signal });
      clearTimeout(t);
      return res;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;

      // Retry on network-ish errors only
      const name = err?.name || '';
      const msg = String(err?.message || '');
      const isTransient =
        name === 'AbortError' ||
        name === 'TypeError' ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg === 'timeout';

      if (attempt < localRetries && isTransient) {
        // backoff 300ms, 600ms, ...
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
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