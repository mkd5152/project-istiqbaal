// src/pages/admin/EventCreate.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useParams } from 'react-router-dom';

const SCHEMA = process.env.REACT_APP_SUPABASE_DB;

export default function EventCreate() {
  const { id } = useParams();
  const isEdit = !!id;

  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );

  // Lookups
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entryPoints, setEntryPoints] = useState([]);

  const entryPointsByLocation = useMemo(() => {
    const map = new Map();
    (entryPoints || []).forEach(ep => {
      const key = ep.location_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ep);
    });
    for (const [, arr] of map.entries()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [entryPoints]);

  const [eventInfo, setEventInfo] = useState({
    title: '',
    event_type_id: '',
    description: '',
    jaman_included: false,
    require_print: false,
  });

  // Occurrences (for both create and edit; in edit we load existing with ids)
  const [occurrences, setOccurrences] = useState([
    { id: undefined, location_id: '', date: '', start_time: '', end_time: '', entry_point_ids: [] },
  ]);

  // UX
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState(''); // success | error

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load lookups
  useEffect(() => {
    (async () => {
      try {
        const [{ data: t, error: tErr }, { data: locs, error: lErr }, { data: eps, error: eErr }] = await Promise.all([
          supabase.schema(SCHEMA).from('event_types').select('id,name,code,status').order('name'),
          supabase.schema(SCHEMA).from('locations').select('id,name').order('name'),
          supabase.schema(SCHEMA).from('entry_points').select('id,name,location_id,status').order('name'),
        ]);

        if (tErr || lErr || eErr) throw tErr || lErr || eErr;

        setTypes((t || []).filter(r => (r.status || 'active') === 'active'));
        setLocations(locs || []);
        setEntryPoints((eps || []).filter(ep => (ep.status || 'active') === 'active'));
      } catch (err) {
        console.error('Lookup fetch error', err);
        setStatus('Failed to load lookups. Please refresh.', 'error');
      }
    })();
  }, []);

  // In EDIT mode, load the event + its occurrences + EEP mappings
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setLoading(true);

        const [{ data: ev, error: evErr }, { data: els, error: elErr }] = await Promise.all([
          supabase
            .schema(SCHEMA)
            .from('events')
            .select('*')
            .eq('id', id)
            .maybeSingle(),
          supabase
            .schema(SCHEMA)
            .from('event_locations')
            .select(`
              id,
              location_id,
              event_date,
              start_time,
              end_time,
              event_entry_points ( entry_point_id )
            `)
            .eq('event_id', id)
            .is('deleted_at', null)
            .order('id', { ascending: true }),
        ]);

        if (evErr) throw evErr;
        if (!ev) {
          setStatus('Event not found.', 'error');
          return;
        }
        if (elErr) throw elErr;

        setEventInfo({
          title: ev.title || '',
          event_type_id: ev.event_type_id ? String(ev.event_type_id) : '',
          description: ev.description || '',
          jaman_included: !!ev.jaman_included,
          require_print: !!ev.require_print,
        });

        const occs = (els || []).map(el => ({
          id: el.id,
          location_id: el.location_id ? String(el.location_id) : '',
          date: el.event_date ? String(el.event_date).slice(0, 10) : '',
          start_time: el.start_time ? String(el.start_time).slice(0, 5) : '',
          end_time: el.end_time ? String(el.end_time).slice(0, 5) : '',
          entry_point_ids: Array.isArray(el.event_entry_points)
            ? el.event_entry_points.map(x => String(x.entry_point_id))
            : [],
        }));

        setOccurrences(occs.length ? occs : [
          { id: undefined, location_id: '', date: '', start_time: '', end_time: '', entry_point_ids: [] },
        ]);
      } catch (err) {
        console.error('Load event error', err);
        setStatus('Failed to load event.', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, id]);

  const setStatus = (msg, kind) => {
    setStatusMessage(msg || '');
    setStatusType(kind || '');
  };

  // helpers to mutate state
  const updateEventInfo = (field, value) => {
    setEventInfo(p => ({ ...p, [field]: value }));
    if (statusMessage) setStatus('', '');
  };

  const updateOccurrence = (idx, field, value) => {
    setOccurrences(list => {
      const copy = [...list];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === 'location_id') copy[idx].entry_point_ids = [];
      return copy;
    });
    if (statusMessage) setStatus('', '');
  };

  const addOccurrence = () => {
    setOccurrences(list => [
      ...list,
      { id: undefined, location_id: '', date: '', start_time: '', end_time: '', entry_point_ids: [] },
    ]);
  };

  const removeOccurrence = (idx) => {
    setOccurrences(list => list.filter((_, i) => i !== idx));
  };

  // Validation (client-side)
  const validate = () => {
    if (!eventInfo.title.trim()) return 'Event title is required.';
    if (!String(eventInfo.event_type_id)) return 'Event Type is required.';
    if (!occurrences.length) return 'At least one location is required.';
    for (let i = 0; i < occurrences.length; i++) {
      const oc = occurrences[i];
      const label = `Occurrence #${i + 1}`;
      if (!String(oc.location_id)) return `${label}: Location is required.`;
      if (!oc.date) return `${label}: Date is required.`;
      if (!oc.start_time) return `${label}: From time is required.`;
      if (oc.end_time && oc.end_time <= oc.start_time) {
        return `${label}: End time must be after start time.`;
      }
      if (!oc.entry_point_ids?.length) return `${label}: At least one entry point is required.`;
    }
    return null;
  };

  // Submit → create or upsert (edit)
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setStatus('', '');
    const err = validate();
    if (err) return setStatus(err, 'error');

    try {
      setSubmitting(true);

      const p_event = {
        title: eventInfo.title.trim(),
        event_type_id: Number(eventInfo.event_type_id) || null,
        description: eventInfo.description?.trim() || null,
        jaman_included: !!eventInfo.jaman_included,
        require_print: !!eventInfo.require_print,
      };

      const p_occurrences = occurrences.map(oc => ({
        id: oc.id ? Number(oc.id) : null,
        location_id: Number(oc.location_id),
        date: oc.date,                          // "YYYY-MM-DD"
        start_time: oc.start_time,              // "HH:mm"
        end_time: oc.end_time || null,          // nullable
        entry_point_ids: (oc.entry_point_ids || []).map(Number),
      }));

      if (isEdit) {
        const { error } = await supabase
          .schema(SCHEMA)
          .rpc('upsert_event_with_locations', {
            p_event_id: Number(id),
            p_event,
            p_occurrences,
          });

        if (error) throw error;
        setStatus('Event updated successfully.', 'success');
        return;
      }

      // CREATE path (your existing RPC)
      const { error } = await supabase
        .schema(SCHEMA)
        .rpc('create_event_with_locations', { p_event, p_occurrences });

      if (error) throw error;

      setStatus('Created Event Successfully.', 'success');

      // Reset after create
      setEventInfo({
        title: '',
        event_type_id: '',
        description: '',
        jaman_included: false,
        require_print: false,
      });
      setOccurrences([{ id: undefined, location_id: '', date: '', start_time: '', end_time: '', entry_point_ids: [] }]);
    } catch (ex) {
      console.error(ex);
      setStatus(ex.message || (isEdit ? 'Failed to update event.' : 'Failed to create event.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // UI styles
  const label = { display: 'block', fontWeight: 800, marginBottom: 8 };
  const input = {
    width: '100%', height: 40, borderRadius: 5, border: 'none', outline: 'none',
    background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
  };
  const textareaStyle = { ...input, height: 120 };
  const selectStyle = { ...input, height: 40 };
  const badge = { background: '#A9DFBF', color: '#1C1C1C', borderRadius: 999, padding: '6px 10px', fontWeight: 800 };
  const eventGrid = { display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 1fr', gap: isNarrow ? 12 : 16, padding: '10px 10px 10px 0px' };
  const occurrenceGrid = { display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: isNarrow ? 12 : 16, padding: '10px 10px 10px 0px' };

  if (loading) {
    return <div style={{ padding: 16, fontWeight: 800 }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F5DC', color: '#1C1C1C', padding: isNarrow ? 16 : 24 }}>
      <h1 style={{ marginTop: 0, fontSize: isNarrow ? 28 : 36, fontWeight: 800 }}>
        {isEdit ? `Edit Event #${id}` : 'Create Event & Locations'}
      </h1>

      {/* EVENT CARD */}
      <div style={{ background: '#A9DFBF', borderRadius: 16, padding: isNarrow ? 20 : 30, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: isNarrow ? 20 : 24, fontWeight: 800 }}>Event</h2>
          <span style={badge}>{isEdit ? 'Edit' : 'Step 1'}</span>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label}>Title *</label>
            <input
              style={input}
              placeholder="e.g., Urus Majlis"
              value={eventInfo.title}
              onChange={(e) => updateEventInfo('title', e.target.value)}
            />
          </div>

          <div style={eventGrid}>
            <div>
              <label style={label}>Event Type *</label>
              <select
                style={selectStyle}
                value={eventInfo.event_type_id}
                onChange={(e) => updateEventInfo('event_type_id', e.target.value)}
              >
                <option value="">Select type</option>
                {types.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Jaman Included?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 5, padding: '0px 14px', height: 40, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                <input
                  type="checkbox"
                  checked={eventInfo.jaman_included}
                  onChange={(e) => updateEventInfo('jaman_included', e.target.checked)}
                />
                <span style={{ fontWeight: 800 }}>Food (Jaman) is included</span>
              </label>
            </div>
            <div>
              <label style={label}>Require Print?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 5, padding: '0px 14px', height: 40, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                <input
                  type="checkbox"
                  checked={eventInfo.require_print}
                  onChange={(e) => updateEventInfo('require_print', e.target.checked)}
                />
                <span style={{ fontWeight: 800 }}>Enable pass/label printing</span>
              </label>
            </div>
          </div>

          <div>
            <label style={label}>Description</label>
            <textarea
              style={textareaStyle}
              placeholder="Optional details"
              value={eventInfo.description}
              onChange={(e) => updateEventInfo('description', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* LOCATION CARD — used in BOTH create and edit */}
      <div style={{ marginTop: isNarrow ? 16 : 20, background: '#A9DFBF', borderRadius: 16, padding: isNarrow ? 14 : 18, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: isNarrow ? 20 : 24, fontWeight: 800 }}>Locations (Venue/Date/Time)</h2>
          <span style={badge}>{isEdit ? 'Edit' : 'Step 2'}</span>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {occurrences.map((oc, idx) => {
            const eps = oc.location_id ? (entryPointsByLocation.get(Number(oc.location_id)) || []) : [];
            const endInvalid = oc.end_time && oc.end_time <= oc.start_time;

            return (
              <div key={oc.id ?? `new-${idx}`} style={{ background: '#F5F5DC', borderRadius: 14, padding: isNarrow ? 12 : '20px 40px 20px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800 }}>Location #{idx + 1}</div>
                  {occurrences.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOccurrence(idx)}
                      style={{ background: '#8B0000', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 12px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={occurrenceGrid}>
                  <div>
                    <label style={label}>Location *</label>
                    <select
                      style={selectStyle}
                      value={oc.location_id}
                      onChange={(e) => updateOccurrence(idx, 'location_id', e.target.value)}
                    >
                      <option value="">Select location</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Date *</label>
                    <input
                      type="date"
                      style={input}
                      value={oc.date}
                      onChange={(e) => updateOccurrence(idx, 'date', e.target.value)}
                    />
                  </div>
                </div>

                <div style={occurrenceGrid}>
                  <div>
                    <label style={label}>From time *</label>
                    <input
                      type="time"
                      style={input}
                      value={oc.start_time}
                      onChange={(e) => updateOccurrence(idx, 'start_time', e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={label}>To time</label>
                    <input
                      type="time"
                      style={input}
                      value={oc.end_time}
                      onChange={(e) => updateOccurrence(idx, 'end_time', e.target.value)}
                    />
                    {endInvalid && (
                      <div style={{ marginTop: 6, fontWeight: 800, color: '#8B0000' }}>
                        End time must be after start time.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={label}>Entry Points (multiple)</label>
                  <select
                    multiple
                    style={{ ...selectStyle, minHeight: 120 }}
                    value={oc.entry_point_ids}
                    onChange={(e) => {
                      const vals = Array.from(e.target.options).filter(o => o.selected).map(o => o.value);
                      updateOccurrence(idx, 'entry_point_ids', vals);
                    }}
                    disabled={!oc.location_id}
                  >
                    {eps.map(ep => (
                      <option key={ep.id} value={String(ep.id)}>{ep.name}</option>
                    ))}
                  </select>
                  {!oc.location_id && (
                    <div style={{ marginTop: 6, fontWeight: 600, opacity: 0.8 }}>
                      Select a location to load gates.
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div>
            <button
              type="button"
              onClick={addOccurrence}
              style={{ background: '#1C1C1C', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' }}
            >
              + Add another location
            </button>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div style={{ display: 'flex', gap: 10, marginTop: isNarrow ? 16 : 20 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            background: '#006400', color: '#fff', border: 'none',
            padding: '12px 18px', borderRadius: 999, fontWeight: 800,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Event & Locations')}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{ background: '#fff', color: '#1C1C1C', border: 'none', padding: '12px 18px', borderRadius: 999, fontWeight: 800, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>

      {statusMessage && (
        <div style={{ marginTop: 10, fontSize: isNarrow ? 18 : 20, fontWeight: 800, color: statusType === 'success' ? '#006400' : '#8B0000' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}