// src/components/AdminNav.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// import { adminNav } from '../nav/adminNav';
import CrestPng from '../assets/tkmLogo.png';

const adminNav = [
    { label: 'Home', path: '/' },
    {
        label: 'Setup',
        children: [
            { label: 'Users', path: '/admin/users' },
            { label: 'Event Type', path: '/admin/setup/event-types' },
            { label: 'Location', path: '/admin/setup/locations' },
            { label: 'Entry Points', path: '/admin/setup/entry-points' },
        ],
    },
    {
        label: 'Events',
        children: [
            { label: 'Manage Events', path: '/admin/events' },
            { label: 'Create Event', path: '/admin/events/new' },
        ],
    },
    {
        label: 'Scans',
        children: [
            { label: 'Scan ITS', path: '/scan' },
            { label: 'View Scanned ITS', path: '/admin/view-scans' },
        ],
    },
];

export default function AdminNav() {
    const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null); // label of open dropdown
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const onResize = () => setIsNarrow(window.innerWidth < 900);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Close menus on route change
    useEffect(() => {
        setMobileOpen(false);
        setOpenDropdown(null);
    }, [location.pathname]);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/', { replace: true });
        } catch (e) {
            alert('Logout failed');
        }
    };

    const isParentActive = (item) => {
        if (!item.children) return false;
        return item.children.some(ch => location.pathname.startsWith(ch.path));
    };

    const LinkBase = ({ to, children }) => (
        <NavLink
            to={to}
            style={({ isActive }) => ({
                textDecoration: 'none',
                color: isActive ? '#FFFFFF' : '#1C1C1C',
                background: isActive ? '#006400' : 'transparent',
                padding: '8px 12px',
                borderRadius: 12,
                fontWeight: 800,
                display: 'inline-block',
            })}
        >
            {children}
        </NavLink>
    );

    return (
        <header style={{ background: '#F5F5DC', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: '10px', margin: '0 auto' }}>
                {/* Left: brand + hamburger */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        aria-label="Toggle Menu"
                        onClick={() => setMobileOpen(v => !v)}
                        style={{
                            display: isNarrow ? 'inline-flex' : 'none',
                            background: '#006400',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontWeight: 800,
                            cursor: 'pointer'
                        }}
                    >
                        ☰
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={CrestPng} alt="Logo" style={{ height: 36, width: 'auto' }} />
                        <div style={{ fontWeight: 900, fontSize: 18, color: '#1C1C1C' }}>Admin Console</div>
                    </div>
                </div>

                {/* Center/Left: Nav */}
                <nav
                    style={{
                        display: isNarrow ? (mobileOpen ? 'block' : 'none') : 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flex: 1,
                    }}
                >
                    {/* Top-level items */}
                    <div style={{ display: isNarrow ? 'block' : 'flex', gap: isNarrow ? 0 : 8 }}>
                        {adminNav.map(item => {
                            if (!item.children) {
                                return (
                                    <div key={item.label} style={{ margin: isNarrow ? '8px 0' : 0 }}>
                                        <LinkBase to={item.path}>{item.label}</LinkBase>
                                    </div>
                                );
                            }
                            const open = openDropdown === item.label;
                            const parentActive = isParentActive(item);
                            return (
                                <div
                                    key={item.label}
                                    onMouseEnter={() => !isNarrow && setOpenDropdown(item.label)}
                                    onMouseLeave={() => !isNarrow && setOpenDropdown(null)}
                                    style={{ position: 'relative', margin: isNarrow ? '8px 0' : 0 }}
                                >
                                    <button
                                        onClick={() => setOpenDropdown(open ? null : item.label)}
                                        style={{
                                            background: parentActive ? '#006400' : 'transparent',
                                            color: parentActive ? '#fff' : '#1C1C1C',
                                            border: 'none',
                                            padding: '8px 12px',
                                            borderRadius: 12,
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            width: isNarrow ? '100%' : 'auto',
                                            textAlign: 'left'
                                        }}
                                    >
                                        {item.label} {!isNarrow && '▾'}
                                    </button>

                                    {/* Dropdown */}
                                    <div
                                        style={{
                                            display: open ? 'block' : 'none',
                                            position: isNarrow ? 'static' : 'absolute',
                                            top: isNarrow ? 'auto' : '100%',
                                            left: 0,
                                            background: '#FFFFFF',
                                            border: '1px solid rgba(0,0,0,0.08)',
                                            borderRadius: 12,
                                            boxShadow: '0 8px 18px rgba(0,0,0,0.08)',
                                            padding: 8,
                                            minWidth: 200,
                                            zIndex: 30,
                                        }}
                                    >
                                        {item.children.map(child => (
                                            <div key={child.label} style={{ margin: 2 }}>
                                                <LinkBase to={child.path}>{child.label}</LinkBase>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </nav>

                {/* Right: Logout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: '#006400',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '10px 14px',
                            borderRadius: 999,
                            fontWeight: 800,
                            cursor: 'pointer'
                        }}
                    >
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}