import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

/**
 * EventCreatePage
 * - Creates a Event
 * - Creates one or more Location (events rows) under that Event
 * - Links gates via event_entry_points
 *
 * Requires tables: programs, events, event_entry_points, event_type, locations, entry_points
 */
export default function EventCreate() {
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );

  // Lookups
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entryPoints, setEntryPoints] = useState([]); // all EPs; we’ll filter client-side
  const entryPointsByLocation = useMemo(() => {
    const map = new Map();
    (entryPoints || []).forEach(ep => {
      const key = ep.location_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ep);
    });
    // sort each list by name
    for (const [k, arr] of map.entries()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [entryPoints]);

  // Event form
  const [program, setProgram] = useState({
    title: '',
    event_type_id: '',
    description: '',
    jaman_included: false,
    require_print: false,
  });

  // Location list (multi)
  const [occurrences, setOccurrences] = useState([
    { location_id: '', date: '', start_time: '', end_time: '', entry_point_ids: [] },
  ]);

  // UX state
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
        const [{ data: t }, { data: locs }, { data: eps }] = await Promise.all([
          supabase.from('event_type').select('id, name, code, status').order('name'),
          supabase.from('locations').select('id, name').order('name'),
          supabase.from('entry_points').select('id, name, location_id, status').order('name'),
        ]);
        setTypes((t || []).filter(r => (r.status || 'active') === 'active'));
        setLocations(locs || []);
        setEntryPoints((eps || []).filter(ep => (ep.status || 'active') === 'active'));
      } catch (err) {
        console.error('Lookup fetch error', err);
        setStatus('Failed to load lookups. Please refresh.', 'error');
      }
    })();
  }, []);

  const setStatus = (msg, kind) => {
    setStatusMessage(msg || '');
    setStatusType(kind || '');
  };

  // Helpers for controlled updates
  const updateProgram = (field, value) => {
    setProgram(p => ({ ...p, [field]: value }));
    if (statusMessage) setStatus('', '');
  };

  const updateOccurrence = (idx, field, value) => {
    setOccurrences(list => {
      const copy = [...list];
      copy[idx] = { ...copy[idx], [field]: value };
      // Reset gates if location changed
      if (field === 'location_id') {
        copy[idx].entry_point_ids = [];
      }
      return copy;
    });
    if (statusMessage) setStatus('', '');
  };

  const addOccurrence = () => {
    setOccurrences(list => [
      ...list,
      { location_id: '', date: '', start_time: '', end_time: '', entry_point_ids: [] },
    ]);
  };

  const removeOccurrence = (idx) => {
    setOccurrences(list => list.filter((_, i) => i !== idx));
  };

  // Validation
  const validate = () => {
    if (!program.title.trim()) return 'Event title is required.';
    if (!String(program.event_type_id)) return 'Event Type is required.';
    if (!occurrences.length) return 'At least one occurrence is required.';
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

  // Submit handler
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setStatus('', '');
    const err = validate();
    if (err) return setStatus(err, 'error');

    try {
      setSubmitting(true);

      // 1) Create Event
      const programPayload = {
        title: program.title.trim(),
        event_type_id: Number(program.event_type_id),
        description: program.description?.trim() || null,
        jaman_included: !!program.jaman_included,
        require_print: !!program.require_print,
        status: 'scheduled',
      };

      const { data: prog, error: pErr } = await supabase
        .from('programs')
        .insert(programPayload)
        .select()
        .single();

      if (pErr) throw new Error(`Event create failed: ${pErr.message}`);

      // 2) Create Location (events rows), one per item
      //    Use program title to populate event.title (your events table requires title)
      const createdEvents = [];
      for (const oc of occurrences) {
        const loc = locations.find(l => String(l.id) === String(oc.location_id));
        const eventTitle = loc ? `${programPayload.title} – ${loc.name}` : programPayload.title;

        const eventPayload = {
          program_id: prog.id,
          title: eventTitle,
          type: null, // optional legacy text field; keep null to avoid conflicts
          description: programPayload.description, // reuse program description
          date: oc.date,
          start_time: oc.start_time,
          end_time: oc.end_time || null,
          location_id: Number(oc.location_id),
          jaman_needed: programPayload.jaman_included,
          print_needed: programPayload.require_print,
          event_type_id: programPayload.event_type_id,
        };

        const { data: ev, error: eErr } = await supabase
          .from('events')
          .insert(eventPayload)
          .select()
          .single();
        if (eErr) throw new Error(`Occurrence create failed: ${eErr.message}`);

        createdEvents.push({ event: ev, entry_point_ids: (oc.entry_point_ids || []).map(Number) });
      }

      // 3) Map gates to occurrences
      for (const { event, entry_point_ids } of createdEvents) {
        if (!entry_point_ids.length) continue; // optional
        const rows = entry_point_ids.map(id => ({
          event_id: event.id,
          entry_point_id: id,
        }));
        const { error: mapErr } = await supabase.from('event_entry_points').insert(rows);
        if (mapErr) throw new Error(`Gate mapping failed: ${mapErr.message}`);
      }

      setStatus('Event & occurrences created successfully.', 'success');
      // Reset form
      setProgram({
        title: '',
        event_type_id: '',
        description: '',
        jaman_included: false,
        require_print: false,
      });
      setOccurrences([{ location_id: '', date: '', start_time: '', end_time: '', entry_point_ids: [] }]);

      // Optionally navigate back to Events list:
      // setTimeout(() => (window.location.href = '/admin/events'), 800);

    } catch (ex) {
      console.error(ex);
      setStatus(ex.message || 'Unexpected error while creating program & events.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // UI helpers
  const label = { display: 'block', fontWeight: 800, marginBottom: 8 };
  const input = {
    width: '100%', height: 40, borderRadius: 5, border: 'none', outline: 'none',
    background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
  };
  const textareaStyle = { ...input, height: 120 };
  const selectStyle = { ...input, height: 40 };
  const badge = {
    background: '#A9DFBF', color: '#1C1C1C', borderRadius: 999, padding: '6px 10px', fontWeight: 800,
  };
  const eventGrid = { display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 1fr', gap: isNarrow ? 12 : 16, padding: '10px 10px 10px 0px' };
  const occurrenceGrid = { display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: isNarrow ? 12 : 16, padding: '10px 10px 10px 0px' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F5DC', color: '#1C1C1C', padding: isNarrow ? 16 : 24 }}>
      <h1 style={{ marginTop: 0, fontSize: isNarrow ? 28 : 36, fontWeight: 800 }}>Create Events & Locations</h1>

      {/* EVENT CARD */}
      <div style={{ background: '#A9DFBF', borderRadius: 16, padding: isNarrow ? 20 : 30, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: isNarrow ? 20 : 24, fontWeight: 800 }}>Event</h2>
          <span style={badge}>Step 1</span>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label}>Title *</label>
            <input
              style={input}
              placeholder="e.g., Urus Majlis"
              value={program.title}
              onChange={(e) => updateProgram('title', e.target.value)}
            />
          </div>

          <div style={eventGrid}>
            <div>
              <label style={label}>Event Type *</label>
              <select
                style={selectStyle}
                value={program.event_type_id}
                onChange={(e) => updateProgram('event_type_id', e.target.value)}
              >
                <option value="">Select type</option>
                {types.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Jaman Included?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 5, padding: '0px 14px 0px 14px', height: 40, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                <input
                  type="checkbox"
                  checked={program.jaman_included}
                  onChange={(e) => updateProgram('jaman_included', e.target.checked)}
                />
                <span style={{ fontWeight: 800 }}>Food (Jaman) is included</span>
              </label>
            </div>
            <div>
              <label style={label}>Require Print?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 5, padding: '0px 14px 0px 14px', height: 40, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                <input
                  type="checkbox"
                  checked={program.require_print}
                  onChange={(e) => updateProgram('require_print', e.target.checked)}
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
              value={program.description}
              onChange={(e) => updateProgram('description', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* LOCATION CARD */}
      <div style={{ marginTop: isNarrow ? 16 : 20, background: '#A9DFBF', borderRadius: 16, padding: isNarrow ? 14 : 18, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: isNarrow ? 20 : 24, fontWeight: 800 }}>Locations (Venue/Date/Time)</h2>
          <span style={badge}>Step 2</span>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {occurrences.map((oc, idx) => {
            const eps = oc.location_id ? (entryPointsByLocation.get(Number(oc.location_id)) || []) : [];
            const endInvalid = oc.end_time && oc.end_time <= oc.start_time;

            return (
              <div key={idx} style={{ background: '#F5F5DC', borderRadius: 14, padding: isNarrow ? 12 : '20px 40px 20px 20px' }}>
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
                  <label style={label}>Entry Points (optional, multi)</label>
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
              + Add another occurrence
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
          {submitting ? 'Creating…' : 'Create Event & Location'}
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