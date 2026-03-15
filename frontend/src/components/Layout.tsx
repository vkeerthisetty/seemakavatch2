import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { countPendingSync, getAllOfflineData } from '../utils/offlineCache';
import { syncOfflineData } from '../utils/api';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline]         = useState(navigator.onLine);
  const [pendingSync, setPendingSync]   = useState(0);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState('');

  useEffect(() => {
    const on  = () => { setIsOnline(true);  refreshPending(); };
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);

    // Auto-sync when coming back online
    window.addEventListener('online', handleAutoSync);
    refreshPending();
    const interval = setInterval(refreshPending, 15_000);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
      window.removeEventListener('online',  handleAutoSync);
      clearInterval(interval);
    };
  }, []);

  const refreshPending = async () => {
    const n = await countPendingSync();
    setPendingSync(n);
  };

  const handleSync = useCallback(async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      const data = await getAllOfflineData();
      const total = data.scanLogs.length + data.refugees.length +
                    data.ngoRequests.length + data.verifResults.length;
      if (total === 0) { setSyncMsg('Nothing to sync.'); return; }
      await syncOfflineData({
        scan_logs: data.scanLogs,
        refugees: data.refugees,
        ngo_requests: data.ngoRequests,
        verification_results: data.verifResults,
      });
      setPendingSync(0);
      setSyncMsg(`✓ ${total} records synced`);
    } catch {
      setSyncMsg('Sync failed — retry later');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  }, [isOnline, syncing]);

  async function handleAutoSync() {
    try {
      const data = await getAllOfflineData();
      const total = data.scanLogs.length + data.refugees.length +
                    data.ngoRequests.length + data.verifResults.length;
      if (total > 0) {
        await syncOfflineData({
          scan_logs: data.scanLogs,
          refugees: data.refugees,
          ngo_requests: data.ngoRequests,
          verification_results: data.verifResults,
        });
      }
    } catch {}
  }

  function handleLogout() { logout(); navigate('/'); }

  const roleLabel: Record<string, string> = {
    officer:   user?.officer_role === 'command_officer' ? 'Command Center Officer' : 'Border Control Officer',
    traveller: 'Traveller Portal',
    ngo:       'NGO / Relief Worker',
  };

  const officerSubLabel = user?.role === 'officer'
    ? (user.officer_role === 'command_officer' ? 'COMMAND CENTER · CLASSIFIED' : 'BORDER CONTROL · CLASSIFIED')
    : '';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F6FA', fontFamily: "'Inter', 'Source Sans Pro', system-ui, sans-serif" }}>

      {/* ── TOP HEADER ── */}
      <nav style={{
        background: '#0a1628', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 54, flexShrink: 0,
        borderBottom: '2px solid #FF9933',
      }}>
        {/* Left — Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#FF9933', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, flexShrink: 0,
          }}>🦁</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3 }}>
              SeemaKavatch — Smart Border Management System
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: 0.8 }}>
              MINISTRY OF HOME AFFAIRS · GOVERNMENT OF INDIA
            </div>
          </div>
        </div>

        {/* Center — Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NavLink to="/dashboard" style={({ isActive }) => ({
            color: isActive ? '#FF9933' : 'rgba(255,255,255,0.6)',
            fontWeight: isActive ? 700 : 400,
            fontSize: 12, textDecoration: 'none', padding: '4px 10px',
            borderRadius: 5,
            background: isActive ? 'rgba(255,153,51,0.12)' : 'transparent',
          })}>Dashboard</NavLink>

          {user?.role === 'officer' && (
            <NavLink to="/map" style={({ isActive }) => ({
              color: isActive ? '#FF9933' : 'rgba(255,255,255,0.6)',
              fontWeight: isActive ? 700 : 400,
              fontSize: 12, textDecoration: 'none', padding: '4px 10px',
              borderRadius: 5,
              background: isActive ? 'rgba(255,153,51,0.12)' : 'transparent',
            })}>Border Map</NavLink>
          )}
        </div>

        {/* Right — Status + User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* System Status indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: '4px 10px',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isOnline ? '#22c55e' : '#ef4444',
              boxShadow: isOnline ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
            }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: isOnline ? '#4ade80' : '#f87171', letterSpacing: 0.5 }}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>System Status</div>
            </div>
          </div>

          {/* Pending sync — officers only */}
          {user?.role === 'officer' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: pendingSync > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${pendingSync > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 6, padding: '4px 10px',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: pendingSync > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                  {pendingSync} Pending
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Sync Records</div>
              </div>
              {isOnline && (
                <button onClick={handleSync} disabled={syncing} style={{
                  background: pendingSync > 0 ? '#FF9933' : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: 4, color: '#fff',
                  fontSize: 9, fontWeight: 700, padding: '3px 7px', cursor: 'pointer',
                  letterSpacing: 0.5,
                }}>
                  {syncing ? '⟳' : 'SYNC'}
                </button>
              )}
            </div>
          )}

          {syncMsg && (
            <div style={{ fontSize: 10, color: syncMsg.startsWith('✓') ? '#4ade80' : '#f87171', fontWeight: 700 }}>
              {syncMsg}
            </div>
          )}

          {/* Officer role badge */}
          {user?.role === 'officer' && user.officer_role && (
            <div style={{
              background: user.officer_role === 'command_officer' ? 'rgba(124,58,237,0.2)' : 'rgba(185,28,28,0.2)',
              border: `1px solid ${user.officer_role === 'command_officer' ? 'rgba(124,58,237,0.4)' : 'rgba(185,28,28,0.4)'}`,
              borderRadius: 5, padding: '3px 8px',
              fontSize: 9, fontWeight: 800, letterSpacing: 1,
              color: user.officer_role === 'command_officer' ? '#a78bfa' : '#fca5a5',
            }}>
              {officerSubLabel}
            </div>
          )}

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                {roleLabel[user?.role || ''] || user?.role}
              </div>
            </div>
            <button onClick={handleLogout} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)', borderRadius: 5, padding: '5px 11px',
              fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}>Logout</button>
          </div>
        </div>
      </nav>

      {/* Classified ribbon for officers */}
      {user?.role === 'officer' && (
        <div style={{
          background: user.officer_role === 'command_officer' ? '#4c1d95' : '#991b1b',
          color: '#fff', textAlign: 'center',
          fontSize: 9, fontWeight: 800, letterSpacing: 2, padding: '3px 0',
        }}>
          🔒 RESTRICTED — AUTHORISED PERSONNEL ONLY ·{' '}
          {user.officer_role === 'command_officer'
            ? 'COMMAND CENTER ACCESS — INTERNET REQUIRED'
            : 'BORDER CONTROL — OFFLINE CAPABLE'}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
