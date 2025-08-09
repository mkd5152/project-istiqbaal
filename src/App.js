import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import ScanPage from './pages/ScanPage';

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
      if (error) {
        console.log('getRole error:', error.message);
      }
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
        if (error) {
          console.log('getSession error:', error.message);
        }
        if (session?.user) {
          setUser(session.user);
          const itsFromMeta = session.user.user_metadata?.its_number;
          const itsFromEmail = session.user.email ? session.user.email.split('@')[0] : null;
          const its = itsFromMeta || itsFromEmail;
          if (its) {
            // Fire and forget role fetch; do not block loading
            getRole(its);
          } else {
            setRole(null);
          }
        } else {
          setUser(null);
          setRole(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Keep UI responsive: do not block overall loading here
      if (session?.user) {
        setUser(session.user);
        const itsFromMeta = session.user.user_metadata?.its_number;
        const itsFromEmail = session.user.email ? session.user.email.split('@')[0] : null;
        const its = itsFromMeta || itsFromEmail;
        if (its) getRole(its);
      } else {
        setUser(null);
        setRole(null);
      }
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <LoginPage onLogin={setUser} setRole={setRole} />;
  if (role === 'admin') return <AdminPage user={user} />;
  // Optional: show subtle hint while determining role
  if (roleLoading) return <div className="p-4">Loading...</div>;
  return <ScanPage user={user} />;
}

export default App;