// src/App.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// PAGES
import LoginPage from './pages/LoginPage';
import ScanPage from './pages/ScanPage';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';
import UsersPage from './pages/admin/UsersPage';
import EventsPage from './pages/admin/EventsPage';
import EventCreate from './pages/admin/EventCreate';
import EventTypesPage from './pages/admin/EventTypesPage';
import LocationsPage from './pages/admin/LocationsPage';
import EntryPointsPage from './pages/admin/EntryPointsPage';

// AG Grid community registration
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const lastITSRef = useRef(null);

  const getRole = useCallback(async (its_number) => {
    try {
      setRoleLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('its_number', its_number)
        .single();
      if (error) console.log('getRole error:', error.message);
      setRole(data?.role || null);
    } catch {
      setRole(null);
    } finally {
      setRoleLoading(false);
    }
  }, []);

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

          if (its) {
            if (lastITSRef.current !== its) {
              lastITSRef.current = its;
              getRole(its);
            }
          } else {
            setRole(null);
          }
        } else {
          setUser(null);
          setRole(null);
          lastITSRef.current = null;
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        setUser(null);
        setRole(null);
        lastITSRef.current = null;
        return;
      }

      setUser(session.user);

      const itsFromMeta = session.user.user_metadata?.its_number;
      const itsFromEmail = session.user.email ? session.user.email.split('@')[0] : null;
      const its = itsFromMeta || itsFromEmail;

      if (!its) return;

      // Only (re)fetch role on meaningful events or when ITS changes
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || lastITSRef.current !== its) {
        lastITSRef.current = its;
        getRole(its);
      }
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [getRole]);

  // Loading gates
  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <LoginPage onLogin={setUser} setRole={setRole} />;
  // Only block if role is truly unknown; don't flicker once known
  if (roleLoading && role == null) return <div className="p-4">Loading...</div>;

  const AdminRoute = ({ children }) => (role === 'admin' ? children : <Navigate to="/" replace />);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public / Common */}
        <Route path="/" element={<LandingPage user={user} role={role} />} />
        <Route path="/scan" element={<ScanPage user={user} />} />

        {/* Admin layout with nested routes */}
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>}>
          <Route index element={<Navigate to="users" replace />} />

          {/* Setup (master data) */}
          <Route path="users" element={<UsersPage />} />
          <Route path="setup">
            <Route path="event-types" element={<EventTypesPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="entry-points" element={<EntryPointsPage />} />
          </Route>

          {/* Events */}
          <Route path="events" element={<EventsPage />} />
          <Route path="events/new" element={<EventCreate />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;