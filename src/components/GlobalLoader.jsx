// src/components/GlobalLoader.jsx
import React from 'react';
import { LOADING_EVENT } from '../libs/loading';

export default function GlobalLoader() {
  const [visible, setVisible] = React.useState(
    () => window.__appLoading?.visible || false
  );

  React.useEffect(() => {
    const onChange = (e) => setVisible(!!e.detail?.visible);
    window.addEventListener(LOADING_EVENT, onChange);
    return () => window.removeEventListener(LOADING_EVENT, onChange);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(2px)',
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '20px 22px',
          boxShadow: '0 10px 30px rgba(0,0,0,.15)',
          border: '1px solid rgba(0,0,0,.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          minWidth: 260,
          justifyContent: 'center',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '3px solid #0B7A0B',
            borderRightColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontWeight: 800 }}>Loading…</div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}