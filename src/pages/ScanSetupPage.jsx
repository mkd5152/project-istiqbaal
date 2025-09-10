import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useScanConfig } from '../contexts/ScanConfigContext';
import { useNavigate } from 'react-router-dom';

export default function ScanSetupPage() {
  const SCHEMA = process.env.REACT_APP_SUPABASE_DB || 'itsscanning';
  const { config, setConfig, clearConfig, isComplete } = useScanConfig();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [eventLocations, setEventLocations] = useState([]);
  const [entryPoints, setEntryPoints] = useState([]); // rows from event_entry_points joined with entry_points name
  const [dumpHeaders, setDumpHeaders] = useState([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // load events + dumps
  useEffect(() => {
    (async () => {
      setBusy(true); setErr('');
      try {
        const [{ data: evs }, { data: dumps }] = await Promise.all([
          supabase
            .schema(SCHEMA)
            .from('events')
            .select('id,title,deleted_at')
            .is('deleted_at', null)
            .order('id', { ascending: false }),
          supabase
            .schema(SCHEMA)
            .from('dump_header')
            .select('id,code,name,deleted_at,created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
        ]);
        setEvents(evs || []);
        setDumpHeaders(dumps || []);
      } catch (e) {
        console.error(e);
        setErr('Failed to load events/dumps');
      } finally {
        setBusy(false);
      }
    })();
  }, [SCHEMA]);

  // when event changes → load event_locations
  useEffect(() => {
    if (!config.eventId) { setEventLocations([]); setEntryPoints([]); return; }
    (async () => {
      setBusy(true); setErr('');
      try {
        const { data: locs } = await supabase
          .schema(SCHEMA)
          .from('event_locations')
          .select('id,location_id,event_date,start_time,end_time,deleted_at')
          .eq('event_id', config.eventId)
          .is('deleted_at', null)
          .order('event_date', { ascending: true });
        setEventLocations(locs || []);
        setConfig(c => ({ ...c, eventLocationId: null, eventEntryPointId: null }));
      } catch (e) {
        console.error(e);
        setErr('Failed to load event locations');
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.eventId]);

  // when event_location changes → load event_entry_points + names
  useEffect(() => {
    if (!config.eventLocationId) { setEntryPoints([]); return; }
    (async () => {
      setBusy(true); setErr('');
      try {
        const { data: eep } = await supabase
          .schema(SCHEMA)
          .from('event_entry_points')
          .select('id, entry_point_id, event_location_id, deleted_at')
          .eq('event_location_id', config.eventLocationId)
          .is('deleted_at', null);

        const epIds = Array.from(new Set((eep || []).map(x => x.entry_point_id)));
        let names = new Map();
        if (epIds.length) {
          const { data: eps } = await supabase
            .schema(SCHEMA)
            .from('entry_points')
            .select('id,name')
            .in('id', epIds)
            .is('deleted_at', null);
          names = new Map((eps || []).map(e => [e.id, e.name]));
        }

        const merged = (eep || []).map(x => ({
          eep_id: x.id,                       // this is what SCANS.event_entry_point_id stores
          entry_point_id: x.entry_point_id,   // just for display/join
          name: names.get(x.entry_point_id) || `Gate #${x.entry_point_id}`,
        }));
        setEntryPoints(merged);
        setConfig(c => ({ ...c, eventEntryPointId: null }));
      } catch (e) {
        console.error(e);
        setErr('Failed to load entry points');
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.eventLocationId]);

  const label = { display: 'block', fontWeight: 800, marginBottom: 8 };
  const input = {
    width: '100%', height: 44, borderRadius: 10, border: '1px solid #E2E8F0', padding: '0 12px',
    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
  };
  const card = { background: '#A9DFBF', borderRadius: 16, padding: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5DC', padding: 20 }}>
      <h1 style={{ margin: 0, fontWeight: 800 }}>Scan Setup</h1>

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <div style={card}>
          <label style={label}>Event</label>
          <select
            style={input}
            value={config.eventId || ''}
            onChange={(e) => setConfig(c => ({ ...c, eventId: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">Select event</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>

        <div style={card}>
          <label style={label}>Event Location</label>
          <select
            style={input}
            value={config.eventLocationId || ''}
            onChange={(e) => setConfig(c => ({ ...c, eventLocationId: e.target.value ? Number(e.target.value) : null }))}
            disabled={!config.eventId}
          >
            <option value="">Select location</option>
            {eventLocations.map(l => {
              const date = l.event_date;
              const st = l.start_time?.slice(0,5);
              const et = l.end_time?.slice(0,5) || '';
              return (
                <option key={l.id} value={l.id}>
                  Loc #{l.location_id} — {date} {st}{et ? `–${et}` : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div style={card}>
          <label style={label}>Entry Point (mapped to selected location)</label>
          <select
            style={input}
            value={config.eventEntryPointId || ''}
            onChange={(e) => setConfig(c => ({ ...c, eventEntryPointId: e.target.value ? Number(e.target.value) : null }))}
            disabled={!config.eventLocationId}
          >
            <option value="">Select gate</option>
            {entryPoints.map(ep => (
              <option key={ep.eep_id} value={ep.eep_id}>{ep.name}</option>
            ))}
          </select>
        </div>

        <div style={card}>
          <label style={label}>Dump (optional)</label>
          <select
            style={input}
            value={config.dumpHeaderId || ''}
            onChange={(e) => setConfig(c => ({ ...c, dumpHeaderId: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">No dump (allow all)</option>
            {dumpHeaders.map(d => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div style={{ marginTop: 10, fontWeight: 800, color: '#8B0000' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          onClick={() => navigate('/scan')}
          disabled={!isComplete || busy}
          style={{
            background: '#006400', color: '#fff', border: 'none',
            padding: '12px 18px', borderRadius: 999, fontWeight: 800,
            cursor: !isComplete || busy ? 'not-allowed' : 'pointer',
            opacity: !isComplete || busy ? 0.7 : 1
          }}
        >
          {isComplete ? 'Start Scanning' : 'Complete selections to proceed'}
        </button>
        <button
          onClick={clearConfig}
          style={{ background: '#fff', color: '#1C1C1C', border: '1px solid #E2E8F0', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}