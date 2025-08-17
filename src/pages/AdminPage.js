import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import CrestPng from '../assets/tkmLogo.png';
import AdminNav from '../components/AdminNav';

export default function AdminPage() {
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  const navigate = useNavigate();

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) navigate('/');
  };

  const linkStyle = ({ isActive }) => ({
    textDecoration: 'none',
    fontWeight: 800,
    padding: isNarrow ? '10px 12px' : '12px 18px',
    borderRadius: 999,
    color: isActive ? '#FFFFFF' : '#1C1C1C',
    backgroundColor: isActive ? '#006400' : '#A9DFBF',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F5DC', color: '#1C1C1C', padding: isNarrow ? 16 : 32 }}>
      {/* Top bar with nav */}
      <AdminNav />
      {/* <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(26px,5vw,48px)', fontWeight: 800 }}>Admin</h1>
          <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <NavLink to="/admin/users" style={linkStyle}>Users</NavLink>
            <NavLink to="/admin/events" style={linkStyle}>Events</NavLink>
            <NavLink to="/admin/events/new" style={linkStyle}>+ Create Event</NavLink>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleLogout}
            style={{ backgroundColor: '#006400', color: '#FFFFFF', border: 'none', padding: isNarrow ? '10px 16px' : '12px 24px', borderRadius: 999, fontWeight: 700, cursor: 'pointer' }}
          >
            Logout
          </button>
          <img src={CrestPng} alt="Logo" style={{ height: 'clamp(48px, 10vw, 80px)', width: 'auto' }} />
        </div>
      </div> */}

      {/* Nested routes render here */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: isNarrow ? 12 : 16, boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
        <Outlet />
      </div>
    </div>
  );
}