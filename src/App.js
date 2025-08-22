// src/App.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// Pages
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

// ag-Grid (register community modules once)
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import ViewScans from './pages/admin/ViewScans';
ModuleRegistry.registerModules([AllCommunityModule]);

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  // Track last-seen identity so we don't re-fetch on token refresh / tab focus
  const lastUserIdRef = useRef(null);
  const lastITSRef = useRef(null);

  const getITSFromUser = (u) => {
    if (!u) return null;
    const metaITS = u.user_metadata?.its_number;
    const emailITS = u.email ? u.email.split('@')[0] : null;
    return metaITS || emailITS || null;
  };

  const getRole = useCallback(async (its_number) => {
    try {
      if (!its_number) {
        setRole(null);
        return;
      }
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

    (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) console.log('getSession error:', error.message);

        if (session?.user) {
          const u = session.user;
          setUser(u);
          lastUserIdRef.current = u.id;

          const its = getITSFromUser(u);
          if (its && lastITSRef.current !== its) {
            lastITSRef.current = its;
            getRole(its);
          }
        } else {
          setUser(null);
          setRole(null);
          lastUserIdRef.current = null;
          lastITSRef.current = null;
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore harmless focus/refresh events which otherwise cause rerenders
      if (event === 'TOKEN_REFRESH' || event === 'INITIAL_SESSION') {
        return;
      }

      if (!session?.user) {
        setUser(null);
        setRole(null);
        lastUserIdRef.current = null;
        lastITSRef.current = null;
        return;
      }

      const u = session.user;

      // Only update app state if the actual user changed
      if (lastUserIdRef.current !== u.id) {
        lastUserIdRef.current = u.id;
        setUser(u);
      }

      // Fetch role only when we have a (new) ITS
      const its = getITSFromUser(u);
      if (its && lastITSRef.current !== its) {
        lastITSRef.current = its;
        getRole(its);
      }

      // If you want a guaranteed refresh on SIGNED_IN/USER_UPDATED, keep this:
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const its2 = getITSFromUser(u);
        if (its2 && lastITSRef.current !== its2) {
          lastITSRef.current = its2;
          getRole(its2);
        }
      }
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [getRole]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <LoginPage onLogin={setUser} setRole={setRole} />;
  if (roleLoading && role !== 'admin') return <div className="p-4">Loading...</div>;

  // Guard for Admin-only routes
  const AdminRoute = ({ children }) =>
    role === 'admin' ? children : <Navigate to="/" replace />;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public / Shared */}
        <Route path="/" element={<LandingPage user={user} role={role} />} />
        <Route path="/scan" element={<ScanPage user={user} />} />

        {/* Admin layout + nested routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        >
          {/* Default to Users on /admin */}
          <Route index element={<Navigate to="users" replace />} />

          {/* Setup */}
          <Route path="users" element={<UsersPage />} />
          <Route path="setup">
            <Route path="event-types" element={<EventTypesPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="entry-points" element={<EntryPointsPage />} />
          </Route>

          <Route path="view-scans" element={<ViewScans />} />

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