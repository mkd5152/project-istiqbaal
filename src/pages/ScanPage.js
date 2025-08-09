import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import CrestPng from '../assets/tkmLogo.png';

function ScanPage({ user }) {
  const [its, setITS] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState(''); // 'success' | 'error'
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const getDubaiIsoNow = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const pick = (t) => parts.find((p) => p.type === t)?.value || '00';
    const year = pick('year');
    const month = pick('month');
    const day = pick('day');
    const hour = pick('hour');
    const minute = pick('minute');
    const second = pick('second');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+04:00`;
  };

  const submitScan = useCallback(async () => {
    try {
      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setStatusMessage('Authentication error. Please login again.');
        setStatusType('error');
        return;
      }
      
      if (!session) {
        setStatusMessage('No active session. Please login again.');
        setStatusType('error');
        return;
      }

      console.log('Attempting to insert scan with ITS:', its);
      console.log('User session:', session.user);
      console.log('User ID:', session.user.id);
      console.log('User email:', session.user.email);
      console.log('User metadata:', session.user.user_metadata);
      
      // Store current time as UAE time with +04:00 offset
      const dubaiIso = getDubaiIsoNow();
      
      const { data, error } = await supabase
        .from('scans')
        .insert({ 
          its_number: its,
          scanned_at: dubaiIso
        })
        .select();

      if (error) {
        console.error('Insert error:', error);
        if (error.code === '403') {
          setStatusMessage('Permission denied. Please check your account permissions or contact admin.');
          setStatusType('error');
        } else if (error.code === '23505') {
          setStatusMessage('This ITS number has already been scanned.');
          setStatusType('error');
        } else {
          setStatusMessage('Failed to save scan: ' + error.message);
          setStatusType('error');
        }
        return;
      }

      console.log('Scan inserted successfully:', data);
      setStatusMessage('Scanned Successfully');
      setStatusType('success');
      setITS('');
    } catch (error) {
      console.error('Unexpected error:', error);
      setStatusMessage('An unexpected error occurred. Please try again.');
      setStatusType('error');
    }
  }, [its]);

  useEffect(() => {
    if (its.length === 8) {
      submitScan();
    }
  }, [its, submitScan]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        setStatusMessage('Logout failed');
        setStatusType('error');
      } else {
        // Clear user state and redirect to login
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      setStatusMessage('Logout failed');
      setStatusType('error');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F5F5DC',
      color: '#1C1C1C',
      padding: isNarrow ? '16px' : '32px'
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 6vw, 56px)', fontWeight: 800 }}>Scan ITS</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={handleLogout}
            style={{ 
              backgroundColor: '#006400',
              color: '#FFFFFF',
              border: 'none',
              padding: isNarrow ? '10px 16px' : '12px 24px',
              borderRadius: 999,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
          <img src={CrestPng} alt="Logo" style={{ height: 'clamp(48px, 10vw, 80px)', width: 'auto' }} />
        </div>
      </div>

      {/* Centered input */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: isNarrow ? 60 : 120
      }}>
        <input
          type="text"
          value={its}
          onChange={(e) => {
            setITS(e.target.value.replace(/\D/g, ''));
            if (!e.target.value) {
              setStatusMessage('');
              setStatusType('');
            }
          }}
          maxLength={8}
          placeholder="Enter ITS ID"
          inputMode="numeric"
          style={{
            width: 'min(90vw, 520px)',
            height: isNarrow ? 56 : 64,
            borderRadius: 16,
            border: 'none',
            outline: 'none',
            backgroundColor: '#A9DFBF',
            color: '#1C1C1C',
            padding: '0 24px',
            fontSize: isNarrow ? 18 : 22,
            fontWeight: 700,
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}
        />

        {statusMessage && (
          <div style={{
            marginTop: 16,
            fontSize: isNarrow ? 22 : 32,
            fontWeight: 800,
            color: statusType === 'success' ? '#006400' : '#8B0000'
          }}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScanPage;
