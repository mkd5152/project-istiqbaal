import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { unparse } from 'papaparse';
import CrestPng from '../assets/tkmLogo.png';

function AdminPage({ user }) {
  const [scans, setScans] = useState([]);
  const [newUser, setNewUser] = useState('');
  const [users, setUsers] = useState([]);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState(null); // 'confirmDelete' | 'csvCreated' | 'userCreated'
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    fetchScans();
    fetchUsers();
  }, []);

  const fetchScans = async () => {
    const { data } = await supabase
      .from('scans')
      .select('*')
      .order('id', { ascending: true });
    setScans(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('*');
    console.log('All users in database:', data);
    console.log('Users fetch error:', error);
    setUsers(data || []);
  };

  const exportCSV = () => {
    const csv = unparse(
      (scans || []).map((s) => ({ ITS: s.its_number, Time: formatDubaiTime(s.scanned_at) }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'scans.csv');
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    setModalKind('csvCreated');
    setIsModalOpen(true);
  };

  const deleteAllScans = async () => {
    try {
      setIsDeletingAll(true);
      // Preferred: call RPC to TRUNCATE scans and reset identity
      let rpcError = null;
      try {
        const { error } = await supabase.rpc('truncate_scans_and_reset');
        rpcError = error || null;
      } catch (e) {
        rpcError = e;
      }

      if (rpcError) {
        // Fallback: delete all rows (sequence will NOT reset with this)
        const { error } = await supabase.from('scans').delete().gt('id', 0);
        if (error) {
          console.error('Delete all scans error:', error);
          alert('Failed to delete scans: ' + error.message + '\nIf this persists, set up the RPC function to reset IDs.');
          return;
        }
      }

      await fetchScans();
    } catch (err) {
      console.error('Unexpected delete error:', err);
      alert('Unexpected error while deleting scans');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const createUser = async () => {
    try {
      // Create the user in the users table first
      const { error } = await supabase.from('users').insert({
        its_number: newUser,
        role: 'user'
      });

      if (error) {
        console.error('Database user creation error:', error);
        alert('Error creating user in database: ' + error.message);
        return;
      }

      // Note: Auth user will be created automatically when they first log in
      // The login system handles auth user creation with the email pattern: its_number@its-login.com
      console.log('User created in database. Auth user will be created on first login.');

      setModalKind('userCreated');
      setIsModalOpen(true);
      setNewUser('');
      fetchUsers(); // Refresh the users list
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        alert('Logout failed');
      } else {
        // Clear user state and redirect to login
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed');
    }
  };

  const formatDubaiTime = (isoString) => {
    if (!isoString) return '';
    try {
      const hasTimeZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(isoString);
      if (hasTimeZone) {
        // Convert UTC/offset time to Dubai time for display
        const dt = new Date(isoString);
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Dubai',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(dt);
      }
      // No timezone info: assume it's already stored as Dubai local time; format without conversion
      const [datePart, timePartFull] = isoString.split('T');
      if (!datePart || !timePartFull) return isoString;
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePartFull.split(':');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mon = monthNames[Math.max(0, Math.min(11, parseInt(month, 10) - 1))] || month;
      return `${day} ${mon} ${year}, ${hour}:${minute}`;
    } catch {
      return isoString;
    }
  };

  const openConfirmDelete = () => {
    setModalKind('confirmDelete');
    setIsModalOpen(true);
  };

  const handleModalYes = async () => {
    if (modalKind === 'confirmDelete') {
      setIsModalOpen(false);
      await deleteAllScans();
    } else {
      setIsModalOpen(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F5F5DC',
      color: '#1C1C1C',
      padding: isNarrow ? '16px' : '32px 32px 48px'
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 6vw, 56px)', fontWeight: 800 }}>Admin</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#006400',
              color: '#FFFFFF',
              border: 'none',
              padding: isNarrow ? '10px 16px' : '14px 24px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: isNarrow ? 16 : 18,
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
          <img src={CrestPng} alt="Logo" style={{ height: 'clamp(48px, 10vw, 80px)', width: 'auto' }} />
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 2fr', gap: isNarrow ? 24 : 48 }}>
        {/* Left column - Create users and list */}
        <div>
          <h2 style={{ marginTop: 0, fontSize: 'clamp(22px, 5vw, 40px)', fontWeight: 800 }}>Create Users</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
            <input
              placeholder="Enter ITS ID"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value.replace(/\D/g, ''))}
              style={{
                width: '100%',
                height: isNarrow ? 52 : 56,
                borderRadius: 12,
                border: 'none',
                outline: 'none',
                backgroundColor: '#A9DFBF',
                color: '#1C1C1C',
                padding: '0 20px',
                fontSize: isNarrow ? 16 : 18,
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={createUser}
                disabled={!newUser}
                style={{
                  backgroundColor: '#006400',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: isNarrow ? '12px 18px' : '14px 24px',
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: isNarrow ? 16 : 18,
                  cursor: newUser ? 'pointer' : 'not-allowed',
                  width: isNarrow ? '100%' : 'auto'
                }}
              >
                Create User
              </button>
              <button
                onClick={openConfirmDelete}
                disabled={isDeletingAll}
                style={{
                  backgroundColor: '#006400',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: isNarrow ? '12px 18px' : '14px 24px',
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: isNarrow ? 16 : 18,
                  cursor: isDeletingAll ? 'not-allowed' : 'pointer',
                  width: isNarrow ? '100%' : 'auto'
                }}
              >
                {isDeletingAll ? 'Deleting…' : 'Delete All'}
              </button>
            </div>
          </div>

          <h2 style={{ marginTop: 32, fontSize: 'clamp(18px, 4.5vw, 32px)', fontWeight: 800 }}>All Users</h2>
          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {users.map((u) => (
              <li key={u.id} style={{ marginBottom: 6, fontWeight: 600 }}>{u.its_number} - {u.role}</li>
            ))}
          </ul>
        </div>

        {/* Right column - Scans table */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(22px, 5vw, 40px)', fontWeight: 800 }}>All Scans</h2>
            <button
              onClick={exportCSV}
              style={{
                backgroundColor: '#006400',
                color: '#FFFFFF',
                border: 'none',
                padding: isNarrow ? '10px 14px' : '12px 18px',
                borderRadius: 999,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div style={{
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#A9DFBF',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              backgroundColor: '#006400',
              color: '#FFFFFF',
              fontWeight: 800,
              padding: isNarrow ? '12px 12px' : '14px 16px'
            }}>
              <div>ITS</div>
              <div style={{ borderLeft: '3px solid #1C1C1C', paddingLeft: 12 }}>Time</div>
            </div>

            {/* Body with auto overflow */}
            <div style={{ maxHeight: isNarrow ? '50vh' : '60vh', overflowY: 'auto' }}>
              {(scans || []).map((scan) => (
                <div
                  key={scan.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    padding: isNarrow ? '12px 12px' : '14px 16px',
                    borderTop: '2px solid rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{scan.its_number}</div>
                  <div style={{ borderLeft: '3px solid #1C1C1C', paddingLeft: 12 }}>
                    {formatDubaiTime(scan.scanned_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            position: 'relative',
            backgroundColor: '#F5F5DC',
            borderRadius: 16,
            padding: isNarrow ? '22px 18px 18px' : '28px 24px 24px',
            width: isNarrow ? 'min(92vw, 520px)' : 'min(90vw, 640px)'
          }}>
            <button
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              style={{
                position: 'absolute', right: 12, top: 8,
                background: 'transparent', border: 'none',
                fontSize: isNarrow ? 28 : 32, fontWeight: 700, cursor: 'pointer', color: '#1C1C1C'
              }}
            >
              ×
            </button>

            <div style={{ fontSize: isNarrow ? 20 : 24, fontWeight: 800, color: '#1C1C1C', textAlign: 'center', padding: '8px 12px' }}>
              {modalKind === 'confirmDelete' && (
                <>
                  Are you sure you want to delete ALL scans? This cannot be undone.
                </>
              )}
              {modalKind === 'csvCreated' && 'CSV Created'}
              {modalKind === 'userCreated' && 'New User Created'}
            </div>

            {modalKind === 'confirmDelete' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24, flexWrap: 'wrap' }}>
                <button
                  onClick={handleModalYes}
                  disabled={isDeletingAll}
                  style={{
                    backgroundColor: '#006400', color: '#FFFFFF', border: 'none',
                    padding: isNarrow ? '12px 18px' : '14px 24px', borderRadius: 14, fontWeight: 700, fontSize: isNarrow ? 16 : 18,
                    cursor: isDeletingAll ? 'not-allowed' : 'pointer', minWidth: isNarrow ? 100 : 120
                  }}
                >
                  {isDeletingAll ? 'Deleting…' : 'Yes'}
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    backgroundColor: '#006400', color: '#FFFFFF', border: 'none',
                    padding: isNarrow ? '12px 18px' : '14px 24px', borderRadius: 14, fontWeight: 700, fontSize: isNarrow ? 16 : 18,
                    cursor: 'pointer', minWidth: isNarrow ? 100 : 120
                  }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
