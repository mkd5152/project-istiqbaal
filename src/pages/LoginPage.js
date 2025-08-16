import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import CrestPng from '../assets/tkmLogo.png';

function LoginPage({ onLogin, setRole }) {
  const [its, setITS] = useState('');

  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    try {
      const email = `${its}@its-login.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: its,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();

        if (msg.includes('invalid login') || msg.includes('invalid') || error.status === 400) {
          alert('ITS not provisioned for login yet. Please ask an admin to add you.');
          return;
        }
        if (msg.includes('email not confirmed')) {
          alert('Your login exists but email confirmation is required. Ask admin to provision without confirmation.');
          return;
        }

        alert(`Login failed: ${error.message}`);
        return;
      }

      onLogin(data.user);
    } catch (err) {
      console.error('Login error:', err);
      alert('Login failed. Please try again.');
    }
  };

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
        <h1 style={{
          margin: 0,
          fontWeight: 700,
          fontSize: 40,
          textAlign: 'center'
        }}>Login with ITS</h1>

        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter ITS ID"
          maxLength={8}
          value={its}
          onChange={(e) => setITS(e.target.value.replace(/\D/g, ''))}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 12,
            border: 'none',
            outline: 'none',
            backgroundColor: '#A9DFBF',
            color: '#1C1C1C',
            padding: '0 20px',
            fontSize: 18,
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}
        />

        <button
          type="submit"
          disabled={!its}
          style={{
            width: '60%',
            height: 58,
            borderRadius: 29,
            border: 'none',
            cursor: its ? 'pointer' : 'not-allowed',
            backgroundColor: '#006400',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: 0.4
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default LoginPage;