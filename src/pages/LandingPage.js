import { useNavigate } from 'react-router-dom';
import CrestPng from '../assets/tkmLogo.png';

export default function LandingPage({ user, role }) {
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const isNarrow = typeof window !== 'undefined' ? window.innerWidth < 900 : false;

  const card = {
    background: '#FFFFFF',
    borderRadius: 16,
    padding: isNarrow ? 16 : 24,
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
  };
  const btn = {
    backgroundColor: '#006400',
    color: '#FFFFFF',
    border: 'none',
    padding: isNarrow ? '12px 16px' : '14px 22px',
    borderRadius: 999,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F5DC', color: '#1C1C1C', padding: isNarrow ? 16 : 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(26px, 5vw, 48px)', fontWeight: 800 }}>
          Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <img src={CrestPng} alt="Logo" style={{ height: 'clamp(48px,10vw,80px)', width: 'auto' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 20, marginTop: 28 }}>
        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Quick Scan</h2>
          <p>Record attendance with ITS cards.</p>
          <button style={btn} onClick={() => navigate('/scan')}>Open Scanner</button>
        </div>

        {isAdmin && (
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Admin</h2>
            <p>Manage users and events, and create new events.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={btn} onClick={() => navigate('/admin/users')}>Users</button>
              <button style={btn} onClick={() => navigate('/admin/events')}>Events</button>
              <button style={btn} onClick={() => navigate('/admin/events/new')}>+ Create Event</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}