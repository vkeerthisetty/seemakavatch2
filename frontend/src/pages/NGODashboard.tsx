import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getNGODashboard, getRefugees, getNGORequests, acceptNGORequest, rejectNGORequest, sendBSFAlert } from '../utils/api';
import type { NGO, Refugee, NGORequest } from '../types';

type Tab = 'requests' | 'overview' | 'refugees';

const SAFFRON  = '#FF9933';
const SUCCESS  = '#2E7D32';
const DANGER   = '#C62828';
const WARNING  = '#F9A825';

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, color, background: bg }}>
      {label}
    </span>
  );
}

function HealthBadge({ v }: { v: string }) {
  const map: Record<string, [string, string]> = {
    critical: [DANGER,  '#fef2f2'],
    injured:  [WARNING, '#fef9c3'],
    stable:   [SUCCESS, '#f0fdf4'],
  };
  const [color, bg] = map[v] || [SUCCESS, '#f0fdf4'];
  return <Badge label={v?.toUpperCase() || 'STABLE'} color={color} bg={bg} />;
}

function CapacityBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct > 85 ? DANGER : pct > 60 ? WARNING : SUCCESS;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: '#64748b' }}>Capacity used</span>
        <span style={{ fontWeight: 800, color }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

export default function NGODashboard() {
  const { user } = useAuth();
  const [tab,      setTab]      = useState<Tab>('requests');
  const [ngos,     setNgos]     = useState<NGO[]>([]);
  const [refugees, setRefugees] = useState<Refugee[]>([]);
  const [requests, setRequests] = useState<NGORequest[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAll = () => {
    getNGODashboard().then(r => setNgos(r.data)).catch(() => {});
    getRefugees().then(r => setRefugees(r.data)).catch(() => {});
    getNGORequests().then(r => setRequests(r.data)).catch(() => {});
  };

  useEffect(() => {
    refreshAll();
    pollRef.current = setInterval(refreshAll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const historyRequests = requests.filter(r => r.status !== 'PENDING');

  async function handleAccept(req: NGORequest) {
    setLoading(true);
    try {
      await acceptNGORequest(req.id);
      setMsg(`✅ Accepted — ${req.refugee_name} assigned to ${req.ngo_name}`);
      refreshAll();
    } catch (e: any) {
      setMsg(`❌ ${e?.response?.data?.error || 'Action failed'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(''), 4000);
    }
  }

  async function handleReject(req: NGORequest) {
    setLoading(true);
    try {
      const res = await rejectNGORequest(req.id, rejectReason);
      const fwd = res.data?.forwarded_to;
      setMsg(fwd ? `↩ Rejected & forwarded to ${fwd}` : `↩ Rejected — ${req.refugee_name}`);
      setRejectId(null); setRejectReason('');
      refreshAll();
    } catch (e: any) {
      setMsg(`❌ ${e?.response?.data?.error || 'Action failed'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(''), 5000);
    }
  }

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'requests',  icon: '📋', label: `Requests${pendingRequests.length ? ` (${pendingRequests.length})` : ''}` },
    { id: 'overview',  icon: '📊', label: 'Overview' },
    { id: 'refugees',  icon: '👥', label: 'Refugee List' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 62px)', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: '#064e3b', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#065f46' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤝</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{user?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{user?.user_id}</div>
            </div>
          </div>
          <div style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>
            NGO WORKER
          </div>
          {pendingRequests.length > 0 && (
            <div style={{ marginTop: 8, background: WARNING, color: '#78350f', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
              ⏳ {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 0', flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px', width: '100%', textAlign: 'left',
              background: tab === t.id ? 'rgba(16,185,129,0.2)' : 'transparent',
              borderLeft: `3px solid ${tab === t.id ? '#10b981' : 'transparent'}`,
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.45)',
              fontWeight: tab === t.id ? 700 : 400, fontSize: 13,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              borderRight: 'none', borderTop: 'none', borderBottom: 'none', borderStyle: 'solid',
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#065f46', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          Auto-refreshing every 5s
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', background: '#EAF4FF' }}>

        {/* Toast */}
        {msg && (
          <div style={{
            position: 'fixed', top: 72, right: 20, zIndex: 999,
            background: msg.startsWith('✅') || msg.startsWith('↩') ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${msg.startsWith('✅') || msg.startsWith('↩') ? '#bbf7d0' : '#fecaca'}`,
            color: msg.startsWith('✅') || msg.startsWith('↩') ? '#15803d' : '#b91c1c',
            padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', animation: 'slideIn 0.2s ease',
          }}>{msg}</div>
        )}

        {/* Reject modal */}
        {rejectId !== null && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10, color: '#0f172a' }}>Reject & Auto-Forward</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>This request will automatically be forwarded to the next NGO with available capacity.</p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (optional)..."
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none', resize: 'none', marginBottom: 14 }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setRejectId(null); setRejectReason(''); }}
                  style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  Cancel
                </button>
                <button
                  onClick={() => { const req = requests.find(r => r.id === rejectId); if (req) handleReject(req); }}
                  disabled={loading}
                  style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: DANGER, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  Reject & Forward
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── REQUESTS TAB ── */}
        {tab === 'requests' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>📋 Refugee Assistance Requests</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              {pendingRequests.length > 0
                ? `${pendingRequests.length} pending request${pendingRequests.length > 1 ? 's' : ''} awaiting response`
                : 'No pending requests — all caught up!'}
            </p>

            {/* PENDING */}
            {pendingRequests.length === 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 14, fontWeight: 600 }}>No pending requests</p>
                <p style={{ fontSize: 12 }}>New refugee registrations will appear here automatically.</p>
              </div>
            )}

            {pendingRequests.map(req => (
              <div key={req.id} style={{
                background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 14,
                border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                borderLeft: `5px solid ${SAFFRON}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>{req.refugee_name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>ID: {req.refugee_temp_id}</div>
                      </div>
                      <Badge label="⏳ PENDING" color="#92400e" bg="#fef9c3" />
                      {req.criminal_flag && <Badge label="⚠ CRIMINAL FLAG" color="#b91c1c" bg="#fef2f2" />}
                    </div>

                    {/* Info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                      {[
                        { icon: '🌍', label: 'Origin',      value: req.country_of_origin || '—' },
                        { icon: '🎂', label: 'Age',         value: req.age ? `${req.age} yrs` : '—' },
                        { icon: '🏥', label: 'Health',      value: <HealthBadge v={req.health_condition || 'stable'} /> },
                        { icon: '👨‍👩‍👧', label: 'Family',     value: `${req.family_size || 1} member(s)` },
                      ].map(d => (
                        <div key={d.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '9px 12px' }}>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>{d.icon} {d.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      🏢 Assigned to: <strong>{req.ngo_name}</strong>
                      &nbsp;·&nbsp; 🔁 Attempt #{req.attempt_number}
                      &nbsp;·&nbsp; 📅 {new Date(req.requested_at).toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 20, flexShrink: 0 }}>
                    <button
                      onClick={() => handleAccept(req)}
                      disabled={loading}
                      style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: SUCCESS, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.3 }}
                    >✓ ACCEPT</button>
                    <button
                      onClick={() => setRejectId(req.id)}
                      disabled={loading}
                      style={{ padding: '10px 24px', borderRadius: 8, border: `1.5px solid ${DANGER}`, background: '#fff', color: DANGER, fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.3 }}
                    >✗ REJECT</button>
                    {req.criminal_flag && (
                      <button
                        onClick={() => sendBSFAlert(req.refugee_temp_id).then(() => setMsg(`🚨 BSF Alert sent for ${req.refugee_name}`))}
                        style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                      >🚨 BSF Alert</button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* History */}
            {historyRequests.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Request History</h3>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ background: '#f8fafc' }}>
                      {['Refugee', 'Temp ID', 'NGO', 'Attempt', 'Date', 'Status'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {historyRequests.map(req => (
                        <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 600 }}>{req.refugee_name}</td>
                          <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{req.refugee_temp_id}</td>
                          <td style={{ padding: '9px 14px', color: '#475569' }}>{req.ngo_name}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'center', color: '#64748b' }}>#{req.attempt_number}</td>
                          <td style={{ padding: '9px 14px', fontSize: 11, color: '#64748b' }}>{new Date(req.requested_at).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{
                              padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 800,
                              background: req.status === 'ACCEPTED' ? '#f0fdf4' : '#fef2f2',
                              color: req.status === 'ACCEPTED' ? '#15803d' : '#b91c1c',
                            }}>
                              {req.status === 'ACCEPTED' ? '✓ ACCEPTED' : '✗ REJECTED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', marginBottom: 18 }}>📊 NGO Coordination Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
              {[
                { label: 'Total Refugees',    value: refugees.length,                                     color: '#7c3aed', icon: '🏕️' },
                { label: 'NGOs Active',        value: ngos.length,                                         color: SUCCESS,   icon: '🏢' },
                { label: 'Pending Requests',  value: pendingRequests.length,                              color: WARNING,   icon: '⏳' },
                { label: 'Accepted Requests', value: requests.filter(r => r.status === 'ACCEPTED').length, color: SUCCESS,   icon: '✅' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', borderTop: `3px solid ${c.color}`, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 600 }}>{c.icon} {c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {ngos.map(ngo => (
                <div key={ngo.ngo_id} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', borderTop: `4px solid ${SAFFRON}`, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{ngo.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📍 {ngo.headquarters}</div>
                    </div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 800, color: '#15803d' }}>ACTIVE</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: 'Capacity',  value: ngo.capacity,                                              color: '#0f172a' },
                      { label: 'Assigned',  value: ngo.assigned_count ?? (ngo.refugee_count || 0),             color: SAFFRON  },
                      { label: 'Available', value: ngo.available_slots ?? (ngo.capacity - (ngo.assigned_count ?? ngo.refugee_count ?? 0)), color: SUCCESS },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 7, padding: '8px 4px' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <CapacityBar used={ngo.assigned_count ?? ngo.refugee_count ?? 0} total={ngo.capacity} />
                  {(ngo.pending_requests ?? 0) > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: '#92400e', background: '#fef9c3', padding: '5px 10px', borderRadius: 5, fontWeight: 700 }}>
                      ⏳ {ngo.pending_requests} pending
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REFUGEE LIST TAB ── */}
        {tab === 'refugees' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>👥 Refugee Directory</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>{refugees.length} individuals registered</p>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Temp ID', 'Name', 'Origin', 'Age', 'Health', 'Family', 'NGO', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {refugees.map(r => (
                    <tr key={r.temp_id} style={{ borderBottom: '1px solid #f1f5f9', background: r.criminal_flag ? '#fffbfb' : '#fff' }}>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>{r.temp_id}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 700 }}>
                        {r.name}{r.criminal_flag ? <span style={{ marginLeft: 5, fontSize: 9, background: '#fef2f2', color: '#b91c1c', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>⚠</span> : null}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#475569' }}>{r.country_of_origin}</td>
                      <td style={{ padding: '9px 14px', color: '#475569' }}>{r.age || '—'}</td>
                      <td style={{ padding: '9px 14px' }}><HealthBadge v={r.health_condition || 'stable'} /></td>
                      <td style={{ padding: '9px 14px', textAlign: 'center', color: '#475569' }}>{r.family_size || 1}</td>
                      <td style={{ padding: '9px 14px', fontSize: 12 }}>{r.assigned_ngo}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: r.status === 'active' ? '#f0fdf4' : '#fef9c3', color: r.status === 'active' ? '#15803d' : '#92400e' }}>
                          {r.status?.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
