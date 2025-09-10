import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import CrestPng from '../assets/tkmLogo.png';
import { useScanConfig } from '../contexts/ScanConfigContext';
import { useNavigate } from 'react-router-dom';

function ScanPage({ user }) {
  const SCHEMA = process.env.REACT_APP_SUPABASE_DB || 'itsscanning';
  const { config, isComplete } = useScanConfig();
  const navigate = useNavigate();

  const [its, setITS] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState(''); // 'success' | 'error'
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  const [result, setResult] = useState(null); // { outcome, msg, scannedAtIso, lastScanAtIso?, its, person }

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isComplete) navigate('/scan/setup', { replace: true });
  }, [isComplete, navigate]);

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
    const v = (t) => parts.find((p) => p.type === t)?.value || '00';
    return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}+04:00`;
  };

  const formatDubai = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const calcAge = (dobStr) => {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
  };

  async function fetchPersonProfile(itsNumber, dumpHeaderId) {
    try {
      let q = supabase
        .schema(SCHEMA)
        .from('dump_detail')
        .select('name,dob,jamaat,photo,deleted_at')
        .eq('its_number', itsNumber)
        .is('deleted_at', null);

      if (dumpHeaderId) {
        q = q.eq('dump_header_id', dumpHeaderId).limit(1);
      } else {
        // fallback: latest row for this ITS (if no dump chosen)
        q = q.order('id', { ascending: false }).limit(1);
      }

      const { data, error } = await q;
      if (error || !data || !data.length) return { name: null, dob: null, jamaat: null, photo: null };
      const row = data[0];
      return {
        name: row.name || null,
        dob: row.dob || null,
        jamaat: row.jamaat || null,
        photo: row.photo || null,
      };
    } catch {
      return { name: null, dob: null, jamaat: null, photo: null };
    }
  }

  async function fetchLastScanTime({ itsNumber, eventLocationId, excludeId }) {
    try {
      let q = supabase
        .schema(SCHEMA)
        .from('scans')
        .select('id,scanned_at,deleted_at')
        .eq('its_number', itsNumber)
        .eq('event_location_id', eventLocationId)
        .is('deleted_at', null)
        .order('scanned_at', { ascending: false })
        .limit(1);

      if (excludeId) q = q.neq('id', excludeId);

      const { data } = await q;
      return data?.[0]?.scanned_at || null;
    } catch {
      return null;
    }
  }

  const submitScan = useCallback(async () => {
    try {
      if (!isComplete) {
        setStatusMessage('Select event/location/gate first.');
        setStatusType('error');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setStatusMessage('Authentication error. Please login again.');
        setStatusType('error');
        return;
      }

      const dubaiIso = getDubaiIsoNow();

      const { data, error } = await supabase
        .schema(SCHEMA)
        .rpc('record_scan', {
          p_its: its,
          p_event_location_id: config.eventLocationId,
          p_event_entry_point_id: config.eventEntryPointId,
          p_dump_header_id: config.dumpHeaderId || null,
          p_scanned_at: dubaiIso,
          p_device: null
        });

      if (error) {
        const msg = error.message || 'Scan failed';
        setStatusMessage(msg);
        setStatusType('error');

        const person = await fetchPersonProfile(its, config.dumpHeaderId || null);
        setResult({
          outcome: 'error',
          msg,
          scannedAtIso: dubaiIso,
          its,
          person,
        });
        setITS('');
        return;
      }

      const out = Array.isArray(data) ? data[0] : data; // { id, dup, allowed, msg }
      const person = await fetchPersonProfile(its, config.dumpHeaderId || null);

      if (!out?.allowed) {
        setStatusMessage(out?.msg || 'Not allowed');
        setStatusType('error');
        setResult({
          outcome: 'error',
          msg: out?.msg || 'Not allowed',
          scannedAtIso: dubaiIso,
          its,
          person,
        });
      } else if (out?.dup) {
        const lastScanAt = await fetchLastScanTime({
          itsNumber: its,
          eventLocationId: config.eventLocationId,
          excludeId: out?.id || null,
        });

        setStatusMessage('');
        setStatusType('');
        setResult({
          outcome: 'duplicate',
          msg: 'Duplicate scan',
          scannedAtIso: dubaiIso,
          lastScanAtIso: lastScanAt,
          its,
          person,
        });
      } else {
        setStatusMessage('');
        setStatusType('');
        setResult({
          outcome: 'success',
          msg: 'Scanned Successfully',
          scannedAtIso: dubaiIso,
          its,
          person,
        });
      }
      setITS('');
    } catch (ex) {
      console.error(ex);
      setStatusMessage('Unexpected error. Try again.');
      setStatusType('error');
      const person = await fetchPersonProfile(its, config.dumpHeaderId || null);
      setResult({
        outcome: 'error',
        msg: 'Unexpected error. Try again.',
        scannedAtIso: getDubaiIsoNow(),
        its,
        person,
      });
    }
  }, [its, isComplete, config, SCHEMA]);

  useEffect(() => {
    if (its.length === 8) submitScan();
  }, [its, submitScan]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) window.location.href = '/';
  };

  const StatusBar = () => (
    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 14, fontWeight: 800 }}>
      <span style={{ padding: '4px 10px', borderRadius: 999, background: '#EEF6F1' }}>
        EventLoc #{config.eventLocationId}
      </span>
      <span style={{ padding: '4px 10px', borderRadius: 999, background: '#EEF6F1' }}>
        Gate (EEP) #{config.eventEntryPointId}
      </span>
      <span style={{ padding: '4px 10px', borderRadius: 999, background: '#EEF6F1' }}>
        Dump {config.dumpHeaderId ? `#${config.dumpHeaderId}` : '—'}
      </span>
      <button
        onClick={() => navigate('/scan/setup')}
        style={{ marginLeft: 8, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999, padding: '4px 10px', fontWeight: 800, cursor: 'pointer' }}
      >
        Change
      </button>
    </div>
  );

  // ---------- Result Card UI ----------
  const ResultCard = ({ data }) => {
    if (!data) return null;
    const { outcome, msg, scannedAtIso, lastScanAtIso, its: itsNum, person } = data;
    const success = outcome === 'success';
    const duplicate = outcome === 'duplicate';
    const isError = outcome === 'error';

    const bg = success ? '#EAF7EE' : '#FDEDED';
    const border = success ? '#34A853' : '#D93025';
    const stripe = success ? '#34A853' : '#D93025';
    const text = '#1C1C1C';

    const card = {
      width: 'min(95vw, 860px)',
      marginTop: 18,
      borderRadius: 16,
      border: `2px solid ${border}`,
      background: bg,
      boxShadow: '0 6px 14px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    };

    const row = {
      display: 'grid',
      gridTemplateColumns: isNarrow ? '10px 1fr' : '10px 140px 1fr',
      gap: isNarrow ? 14 : 18,
      alignItems: 'center',
    };

    const stripeStyle = { background: stripe, height: '100%' };

    const photoWrap = {
      width: isNarrow ? '100%' : 120,
      height: isNarrow ? 120 : 120,
      borderRadius: 14,
      border: `2px solid ${border}`,
      background: '#fff',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: isNarrow ? '10px 16px' : '14px 0',
    };

    const imgStyle = { width: '100%', height: '100%', objectFit: 'cover' };
    const body = { padding: isNarrow ? 12 : '16px 16px 16px 0', color: text };

    const title = {
      margin: 0,
      fontSize: isNarrow ? 22 : 26,
      fontWeight: 900,
      lineHeight: 1.25,
      color: text,
    };

    const meta = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
      fontWeight: 800,
    };

    const chip = {
      padding: '6px 10px',
      background: '#fff',
      borderRadius: 999,
      border: `1px solid ${success ? '#9CD7AF' : '#F5B5B0'}`,
      color: text,
      fontSize: 13,
    };

    const note = {
      marginTop: 10,
      fontWeight: 800,
      color: isError || duplicate ? '#8B0000' : '#0B7A0B',
      fontSize: isNarrow ? 14 : 16,
    };

    const subnote = {
      marginTop: 6,
      fontWeight: 700,
      color: '#1C1C1C',
      opacity: 0.8,
      fontSize: isNarrow ? 13 : 14,
    };

    const name = person?.name || '—';
    const age = calcAge(person?.dob);
    const jamaat = person?.jamaat || 'N/A';
    const photo = person?.photo || '';

    return (
      <div style={card}>
        <div style={row}>
          <div style={stripeStyle} />
          {!isNarrow && (
            <div style={photoWrap}>
              {photo ? (
                <img src={photo} alt="Person" style={imgStyle} />
              ) : (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontWeight: 800 }}>
                  No Photo
                </div>
              )}
            </div>
          )}
          <div style={body}>
            <h3 style={title}>
              {name}
              <span style={{ marginLeft: 10, fontSize: isNarrow ? 14 : 16, opacity: 0.7, fontWeight: 800 }}>
                (ITS {itsNum})
              </span>
            </h3>

            {isNarrow && (
              <div style={{ ...photoWrap, width: '100%', height: 200, margin: '12px 0' }}>
                {photo ? (
                  <img src={photo} alt="Person" style={imgStyle} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#94A3B8', fontWeight: 800 }}>
                    No Photo
                  </div>
                )}
              </div>
            )}

            <div style={meta}>
              <span style={chip}>Age: {age ?? 'N/A'}</span>
              <span style={chip}>Jamaat: {jamaat}</span>
              <span style={chip}>Scanned: {formatDubai(scannedAtIso)}</span>
            </div>

            <div style={note}>
              {success && '✅ Entry allowed'}
              {duplicate && '⚠️ Duplicate scan'}
              {isError && `❌ ${msg}`}
            </div>

            {duplicate && lastScanAtIso && (
              <div style={subnote}>
                Last scan for this location: <b>{formatDubai(lastScanAtIso)}</b>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F5DC', color: '#1C1C1C', padding: isNarrow ? '16px' : '32px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px, 6vw, 56px)', fontWeight: 800 }}>Scan ITS</h1>
          {isComplete && <StatusBar />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#006400', color: '#FFFFFF', border: 'none',
              padding: isNarrow ? '10px 16px' : '12px 24px', borderRadius: 999,
              fontWeight: 700, cursor: 'pointer'
            }}
          >
            Logout
          </button>
          <img src={CrestPng} alt="Logo" style={{ height: 'clamp(48px, 10vw, 80px)', width: 'auto' }} />
        </div>
      </div>

      {/* Centered input */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: isNarrow ? 40 : 80 }}>
        <input
          type="text"
          value={its}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            setITS(digits);
            if (!digits) { setStatusMessage(''); setStatusType(''); setResult(null); }
          }}
          maxLength={8}
          placeholder="Enter ITS ID"
          inputMode="numeric"
          style={{
            width: 'min(90vw, 520px)', height: isNarrow ? 56 : 64, borderRadius: 16, border: 'none', outline: 'none',
            backgroundColor: '#A9DFBF',
            color: '#1C1C1C',
            padding: '0 24px',
            fontSize: isNarrow ? 18 : 22,
            fontWeight: 700,
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && its.length === 8) {
              e.preventDefault();
              submitScan();
            }
            if (e.key === 'Escape') {
              setITS('');
              setStatusMessage('');
              setStatusType('');
              setResult(null);
            }
          }}
          autoFocus
        />

        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <button
            onClick={submitScan}
            disabled={its.length !== 8}
            style={{
              background: '#006400',
              color: '#fff',
              border: 'none',
              padding: isNarrow ? '10px 16px' : '12px 24px',
              borderRadius: 999,
              fontWeight: 800,
              cursor: its.length === 8 ? 'pointer' : 'not-allowed',
              opacity: its.length === 8 ? 1 : 0.6,
            }}
            title={its.length === 8 ? 'Submit scan' : 'Enter 8 digits to enable'}
          >
            Scan
          </button>

          <button
            type="button"
            onClick={() => { setITS(''); setStatusMessage(''); setStatusType(''); setResult(null); }}
            style={{
              background: '#fff',
              color: '#1C1C1C',
              border: '1px solid #E2E8F0',
              padding: isNarrow ? '10px 16px' : '12px 24px',
              borderRadius: 999,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>

        {/* Result card */}
        <ResultCard data={result} />

        {/* Bottom text status — keep for non-duplicate errors only */}
        {statusMessage && result?.outcome !== 'duplicate' && (
          <div
            style={{
              marginTop: 12,
              fontSize: isNarrow ? 18 : 20,
              fontWeight: 800,
              color: statusType === 'success' ? '#006400' : '#8B0000',
              textAlign: 'center',
            }}
          >
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScanPage;