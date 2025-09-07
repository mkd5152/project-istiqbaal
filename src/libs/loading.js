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

export async function trackedFetch(input, init) {
  loadingStart();
  try {
    return await fetch(input, init);
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