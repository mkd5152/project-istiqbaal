import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

const eventTypes = ['Lecture','Prayer','Majlis','Dinner','Workshop','Volunteer Drive','Other'];

export default function EventCreate(){
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState(''); // 'success' | 'error'
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState([]);
  const [entryPoints, setEntryPoints] = useState([]);
  const [form, setForm] = useState({
    title:'', type:'', description:'', date:'', start_time:'', end_time:'',
    location_id:'', entry_point_ids:[], jaman_needed:false, print_needed:false
  });

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: locs }, { data: eps }] = await Promise.all([
          supabase.from('locations').select('id,name').order('name'),
          supabase.from('entry_points').select('id,name').order('name'),
        ]);
        setLocations(locs || []);
        setEntryPoints(eps || []);
      } catch (err) {
        console.error('Lookup error:', err);
        setStatusMessage('Failed to load locations/entry points.');
        setStatusType('error');
      }
    })();
  }, []);

  const endTimeInvalid = useMemo(() => form.end_time && form.end_time <= form.start_time, [form.start_time, form.end_time]);
  const submitDisabled = useMemo(() =>
    !form.title || !form.date || !form.start_time || !form.location_id || !!endTimeInvalid,
    [form, endTimeInvalid]
  );

  const onChange = (e) => {
    const { name, value, type, checked, multiple, options } = e.target;
    if (type === 'checkbox') setForm((p) => ({ ...p, [name]: checked }));
    else if (multiple) {
      const vals = Array.from(options).filter((o) => o.selected).map((o) => o.value);
      setForm((p) => ({ ...p, [name]: vals }));
    } else setForm((p) => ({ ...p, [name]: value }));
    if (statusMessage) { setStatusMessage(''); setStatusType(''); }
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setStatusMessage(''); setStatusType('');
    if (submitDisabled) { setStatusMessage('Please fill all required fields and fix validation errors.'); setStatusType('error'); return; }
    try {
      setSubmitting(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) { setStatusMessage('Authentication error. Please login again.'); setStatusType('error'); return; }

      const payload = {
        title: form.title.trim(),
        type: form.type || null,
        description: form.description || null,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        location_id: Number(form.location_id),
        jaman_needed: !!form.jaman_needed,
        print_needed: !!form.print_needed,
      };

      const { data: event, error: e1 } = await supabase.from('events').insert(payload).select().single();
      if (e1) { setStatusMessage(e1.message || 'Failed to create event.'); setStatusType('error'); return; }

      const rows = (form.entry_point_ids || []).map((id) => ({
        event_id: event.id, entry_point_id: Number(id)
      }));
      if (rows.length) {
        const { error: e2 } = await supabase.from('event_entry_points').insert(rows);
        if (e2) { setStatusMessage('Event created, but failed to link entry points.'); setStatusType('error'); return; }
      }

      setStatusMessage('Event created successfully.'); setStatusType('success');
      setForm({ title:'', type:'', description:'', date:'', start_time:'', end_time:'', location_id:'', entry_point_ids:[], jaman_needed:false, print_needed:false });
    } catch (err) {
      console.error('Unexpected error:', err);
      setStatusMessage('An unexpected error occurred. Please try again.');
      setStatusType('error');
    } finally {
      setSubmitting(false);
    }
  }, [form, submitDisabled]);

  const label = { display:'block', fontWeight:800, marginBottom:8 };
  const input = { width:'100%', height:48, borderRadius:16, border:'none', outline:'none', background:'#fff', padding:'0 14px', boxShadow:'0 2px 6px rgba(0,0,0,0.06)' };
  const selectStyle = { ...input, height:52 };
  const grid = { display:'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: isNarrow ? 12 : 16 };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Create Event</h2>
      <form onSubmit={handleSubmit} style={{ display:'grid', gap:14, marginTop:8 }}>
        <div>
          <label style={label}>Title *</label>
          <input name="title" value={form.title} onChange={onChange} placeholder="e.g., Shab-e Barat Majlis" style={input} />
        </div>

        <div style={grid}>
          <div>
            <label style={label}>Type</label>
            <select name="type" value={form.type} onChange={onChange} style={selectStyle}>
              <option value="">Select type</option>
              {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Location *</label>
            <select name="location_id" value={form.location_id} onChange={onChange} style={selectStyle}>
              <option value="">Select location</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={label}>Description</label>
          <textarea name="description" value={form.description} onChange={onChange} placeholder="Optional details..." style={{ ...input, height:120, padding:'12px 14px' }} />
        </div>

        <div style={grid}>
          <div>
            <label style={label}>Date *</label>
            <input type="date" name="date" value={form.date} onChange={onChange} style={input} />
          </div>
          <div>
            <label style={label}>Entry Points (multi)</label>
            <select multiple name="entry_point_ids" value={form.entry_point_ids} onChange={onChange} style={{ ...selectStyle, minHeight:120 }}>
              {entryPoints.map(ep => <option key={ep.id} value={String(ep.id)}>{ep.name}</option>)}
            </select>
          </div>
        </div>

        <div style={grid}>
          <div>
            <label style={label}>From time *</label>
            <input type="time" name="start_time" value={form.start_time} onChange={onChange} style={input} />
          </div>
          <div>
            <label style={label}>To time</label>
            <input type="time" name="end_time" value={form.end_time} onChange={onChange} style={input} />
            {endTimeInvalid && <div style={{ marginTop:8, fontWeight:800, color:'#8B0000' }}>End time must be after start time.</div>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: isNarrow ? 12 : 16 }}>
          <label htmlFor="jaman_needed" style={{ display:'flex', alignItems:'center', gap:10, background:'#A9DFBF', padding:'10px 12px', borderRadius:999 }}>
            <input id="jaman_needed" type="checkbox" name="jaman_needed" checked={form.jaman_needed} onChange={onChange} />
            <span style={{ fontWeight:800 }}>Jaman needed?</span>
          </label>
          <label htmlFor="print_needed" style={{ display:'flex', alignItems:'center', gap:10, background:'#A9DFBF', padding:'10px 12px', borderRadius:999 }}>
            <input id="print_needed" type="checkbox" name="print_needed" checked={form.print_needed} onChange={onChange} />
            <span style={{ fontWeight:800 }}>Require print?</span>
          </label>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" disabled={submitting || submitDisabled} style={{ background:'#006400', color:'#fff', border:'none', padding:'12px 18px', borderRadius:999, fontWeight:800, cursor: submitting || submitDisabled ? 'not-allowed' : 'pointer', opacity: submitting || submitDisabled ? 0.7 : 1 }}>
            {submitting ? 'Creating…' : 'Create Event'}
          </button>
          <button type="button" onClick={() => window.history.back()} style={{ background:'#fff', color:'#1C1C1C', border:'none', padding:'12px 18px', borderRadius:999, fontWeight:800, cursor:'pointer' }}>
            Cancel
          </button>
        </div>

        {statusMessage && (
          <div style={{ marginTop: 8, fontSize: isNarrow ? 18 : 20, fontWeight: 800, color: statusType === 'success' ? '#006400' : '#8B0000' }}>
            {statusMessage}
          </div>
        )}
      </form>
    </div>
  );
}