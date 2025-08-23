// src/pages/LoginPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import CrestPng from '../assets/tkmLogo.png';

export default function LoginPage({ onLogin, setRole }) {
  const [its, setITS] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If a leftover session exists, sign it out so we don’t confuse the operator
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.auth.signOut();
      }
    })();
  }, []);

  async function handleLogin(e) {
    e?.preventDefault();
    const its8 = String(its || '').replace(/\D/g, '').slice(0, 8);
    if (its8.length !== 8) return alert('Enter a valid 8-digit ITS.');

    try {
      setSubmitting(true);

      const email = `${its8}@its-login.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: its8,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid')) return alert('ITS not provisioned for login yet. Please ask an admin to add you.');
        if (msg.includes('email not confirmed')) return alert('Your login exists but email confirmation is required. Ask admin to provision without confirmation.');
        
        return alert(`Login failed: ${error.message}`);
      }

      const { data: urow, error: uerr } = await supabase
        .from('users')
        .select('role,status,deleted_at,its_number')
        .eq('its_number', its8)
        .limit(1)
        .maybeSingle();

      if (uerr || !urow || urow.deleted_at || (urow.status && urow.status !== 'active')) {
        await supabase.auth.signOut();
        return alert('Your account is not provisioned/active. Please ask an admin.');
      }

      onLogin?.(data.user);
      setRole?.(urow.role ?? null);
    } catch (err) {
      console.error(err);
      alert('Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5DC',
      color: '#1C1C1C'
    }}>
      <form onSubmit={handleLogin} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        width: 'min(90vw, 520px)'
      }}>
        <img src={CrestPng} alt="Logo" style={{ width: 140, height: 'auto' }} />
        <h1 style={{ margin: 0, fontWeight: 700, fontSize: 40, textAlign: 'center' }}>
          Login with ITS
        </h1>

        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter ITS ID"
          maxLength={8}
          value={its}
          onChange={(e) => setITS(e.target.value.replace(/\D/g, ''))}
          style={{
            width: '100%', height: 56, borderRadius: 12, border: 'none', outline: 'none',
            backgroundColor: '#A9DFBF', color: '#1C1C1C', padding: '0 20px',
            fontSize: 18, fontWeight: 600, boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}
        />

        <button
          type="submit"
          disabled={!its || submitting}
          style={{
            width: '60%', height: 58, borderRadius: 29, border: 'none',
            cursor: (!its || submitting) ? 'not-allowed' : 'pointer',
            backgroundColor: '#006400', color: '#FFFFFF',
            fontWeight: 700, fontSize: 24, letterSpacing: 0.4, opacity: submitting ? .7 : 1
          }}
        >
          {submitting ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}