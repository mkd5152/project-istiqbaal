import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ScanPage from './pages/ScanPage';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';
import UsersPage from './pages/admin/UsersPage';
import EventsPage from './pages/admin/EventsPage';
import EventCreate from './pages/admin/EventCreate';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-quartz.css';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  const getRole = async (its_number) => {
    try {
      setRoleLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('its_number', its_number)
        .single();
      if (error) console.log('getRole error:', error.message);
      setRole(data?.role || null);
    } catch (e) {
      console.log('getRole exception:', e);
      setRole(null);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) console.log('getSession error:', error.message);
        if (session?.user) {
          setUser(session.user);
          const itsFromMeta = session.user.user_metadata?.its_number;
          const itsFromEmail = session.user.email ? session.user.email.split('@')[0] : null;
          const its = itsFromMeta || itsFromEmail;
          if (its) getRole(its); else setRole(null);
        } else {
          setUser(null); setRole(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const itsFromMeta = session.user.user_metadata?.its_number;
        const itsFromEmail = session.user.email ? session.user.email.split('@')[0] : null;
        const its = itsFromMeta || itsFromEmail;
        if (its) getRole(its);
      } else {
        setUser(null); setRole(null);
      }
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <LoginPage onLogin={setUser} setRole={setRole} />;
  if (roleLoading && role !== 'admin') return <div className="p-4">Loading...</div>;

  const AdminRoute = ({ children }) => (role === 'admin' ? children : <Navigate to="/" replace />);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage user={user} role={role} />} />
        <Route path="/scan" element={<ScanPage user={user} />} />

        <Route path="/admin" element={<AdminRoute><AdminPage user={user} /></AdminRoute>}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/new" element={<EventCreate />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;