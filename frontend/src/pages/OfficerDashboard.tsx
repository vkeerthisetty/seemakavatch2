import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getDashboard, getAllTravellers, getAlerts, scanQR, getScanLogs,
  getRefugees, getBorderStatistics, getNGORequests, getActiveEmergencies,
  registerRefugee,
} from '../utils/api';
import {
  lookupOfflineQR, countPendingSync, addOfflineScanLog,
  addOfflineRefugee, addOfflineNGORequest, cacheQRRecord,
} from '../utils/offlineCache';
import type { DashboardData, Traveller, ScanLog, BorderStats, NGORequest, Refugee, EmergencyRegion } from '../types';

// ── Static data ──────────────────────────────────────────────────────────────
const CHECKPOINTS = [
  'Wagah, Punjab','Nathu La, Sikkim','Petrapole, West Bengal',
  'Moreh, Manipur','Raxaul, Bihar','Mumbai Port','Delhi Airport','Chennai Port'
];

const CP_STATS: Record<string, { cleared: number; flagged: number; vehicles: number; immigrants: number }> = {
  'Wagah, Punjab':          { cleared: 7842, flagged: 23, vehicles: 1204, immigrants: 42 },
  'Petrapole, West Bengal': { cleared: 5621, flagged: 14, vehicles: 892,  immigrants: 31 },
  'Raxaul, Bihar':          { cleared: 3102, flagged: 8,  vehicles: 641,  immigrants: 18 },
  'Nathu La, Sikkim':       { cleared: 412,  flagged: 5,  vehicles: 88,   immigrants: 3  },
  'Moreh, Manipur':         { cleared: 891,  flagged: 19, vehicles: 203,  immigrants: 24 },
  'Mumbai Port':            { cleared: 2341, flagged: 7,  vehicles: 0,    immigrants: 11 },
  'Delhi Airport':          { cleared: 9842, flagged: 31, vehicles: 0,    immigrants: 58 },
  'Chennai Port':           { cleared: 1203, flagged: 4,  vehicles: 0,    immigrants: 7  },
};

const DEMO_QRS = [
  { id: 'EBI-P8821456X-2024-WA', label: 'Sarah Mitchell — USA',         valid: true,  visa: 'Tourist',      nationality: 'United States' },
  { id: 'EBI-JP2023998-2024-AT', label: 'Yuki Tanaka — Japan',          valid: true,  visa: 'Business',     nationality: 'Japan'         },
  { id: 'EBI-DE4410023-2024-MU', label: 'Hans Mueller — Germany',       valid: true,  visa: 'Medical',      nationality: 'Germany'       },
  { id: 'EBI-AU7823001-2024-PE', label: 'Emily Clarke — Australia',     valid: true,  visa: 'Tourist',      nationality: 'Australia'     },
  { id: 'EBI-FR5510098-2024-CH', label: 'Pierre Dupont — France',       valid: true,  visa: 'Research',     nationality: 'France'        },
  { id: 'EBI-FP9943021-2024-NA', label: 'Chen Wei — CRIMINAL DB HIT',   valid: false, visa: 'Tourist',      nationality: 'China'         },
  { id: 'EBI-M7731004K-2024-PE', label: 'Arjun Das — FORGED PASSPORT',  valid: false, visa: 'Tourist',      nationality: 'Bangladesh'    },
  { id: 'EBI-PK9920011-2024-WA', label: 'Ali Hassan — LOOKOUT NOTICE',  valid: false, visa: 'Humanitarian', nationality: 'Pakistan'      },
  { id: 'EBI-UK5590011-2024-WA', label: 'James Bhatt — INTERPOL',       valid: false, visa: 'Business',     nationality: 'United Kingdom'},
  { id: 'EBI-NP8823310-2024-RA', label: 'Ram Thapa — TAMPERED VISA',    valid: false, visa: 'Work',         nationality: 'Nepal'         },
];

const LIVE_FEED = [
  { time: '14:32', name: 'Maria Santos',     from: 'Brazil',       cp: 'Mumbai Port',    status: 'cleared', visa: 'Tourist'   },
  { time: '14:28', name: 'Feng Liu',         from: 'China',        cp: 'Delhi Airport',  status: 'cleared', visa: 'Business'  },
  { time: '14:21', name: 'Unknown Male',     from: 'Bangladesh',   cp: 'Petrapole',      status: 'flagged', visa: 'None'      },
  { time: '14:18', name: 'Anna Kowalski',    from: 'Poland',       cp: 'Delhi Airport',  status: 'cleared', visa: 'Tourist'   },
  { time: '14:09', name: 'Daud Mirza',       from: 'Afghanistan',  cp: 'Wagah',          status: 'flagged', visa: 'Transit'   },
  { time: '14:02', name: 'Hiroshi Tanaka',   from: 'Japan',        cp: 'Chennai Port',   status: 'cleared', visa: 'Business'  },
  { time: '13:55', name: 'Sofia Rossi',      from: 'Italy',        cp: 'Delhi Airport',  status: 'cleared', visa: 'Tourist'   },
  { time: '13:48', name: 'Mohammed Al-Amin', from: 'Syria',        cp: 'Moreh',          status: 'flagged', visa: 'Refugee'   },
];

const COUNTRIES = ['Afghanistan','Bangladesh','Myanmar','Somalia','Syria','Iran','Ethiopia','Sri Lanka','Nepal'];
const NGOS_LIST  = ['Red Cross India','Refugee Aid India','Helping Hands Foundation','UNHCR India','CARE India'];
const CHECKPOINTS_LIST = [
  'Wagah, Punjab','Nathu La, Sikkim','Petrapole, West Bengal',
  'Moreh, Manipur','Raxaul, Bihar','Mumbai Port','Delhi Airport','Chennai Port',
];

// ── Types ────────────────────────────────────────────────────────────────────
type BorderTab = 'dashboard' | 'scanner' | 'travellers' | 'alerts' | 'refugees' | 'register';
type CommandTab = 'analytics' | 'activity' | 'alerts' | 'refugees' | 'ngo';

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, trend }: {
  label: string; value: string | number; sub?: string; color: string; icon: string; trend?: string;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '18px 20px',
      borderTop: `3px solid ${color}`, boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: 14, top: 14, fontSize: 26, opacity: 0.07 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 5, fontWeight: 600 }}>{label}</div>
      {sub   && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      {trend && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>{trend}</div>}
    </div>
  );
}

function SidebarNav({ tabs, active, onSelect, color }: {
  tabs: { id: string; icon: string; label: string }[];
  active: string; onSelect: (id: string) => void; color: string;
}) {
  return (
    <div style={{ padding: '10px 0', flex: 1 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', width: '100%', textAlign: 'left',
          background: active === t.id ? `${color}22` : 'transparent',
          borderLeft: `3px solid ${active === t.id ? color : 'transparent'}`,
          color: active === t.id ? '#fff' : 'rgba(255,255,255,0.45)',
          fontWeight: active === t.id ? 700 : 400,
          fontSize: 13, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          borderRight: 'none', borderTop: 'none', borderBottom: 'none', borderStyle: 'solid',
        }}>
          <span style={{ fontSize: 16 }}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Bar chart component (pure CSS, no library needed) ──────────────────────
function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, padding: '0 4px' }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>{d.value}</div>
          <div style={{
            width: '100%', height: `${Math.max(4, (d.value / max) * 60)}px`,
            background: color, borderRadius: '4px 4px 0 0',
            transition: 'height 0.5s ease',
          }} />
          <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>
            {d.label.replace('2024-', '').replace('2025-', '')}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function OfficerDashboard() {
  const { user } = useAuth();
  const isBorderOfficer  = user?.officer_role === 'border_officer' || !user?.officer_role;
  const isCommandOfficer = user?.officer_role === 'command_officer';

  const [borderTab,  setBorderTab]  = useState<BorderTab>('dashboard');
  const [commandTab, setCommandTab] = useState<CommandTab>('analytics');

  const [dashboard,   setDashboard]   = useState<DashboardData | null>(null);
  const [borderStats, setBorderStats] = useState<BorderStats | null>(null);
  const [travellers,  setTravellers]  = useState<Traveller[]>([]);
  const [alerts,      setAlerts]      = useState<Traveller[]>([]);
  const [scanLogs,    setScanLogs]    = useState<ScanLog[]>([]);
  const [refugees,    setRefugees]    = useState<Refugee[]>([]);
  const [ngoRequests, setNgoRequests] = useState<NGORequest[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRegion[]>([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState<string[]>([]);

  const [scanInput,   setScanInput]   = useState('');
  const [scanResult,  setScanResult]  = useState<any>(null);
  const [scanning,    setScanning]    = useState(false);
  const [isOnline,    setIsOnline]    = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [search,      setSearch]      = useState('');
  const [feedIdx,     setFeedIdx]     = useState(0);

  // Refugee registration form
  const [regForm, setRegForm] = useState({
    name: '', country_of_origin: 'Afghanistan', dob: '', age: '',
    entry_checkpoint: 'Wagah, Punjab', assigned_ngo: '',
    health_condition: 'stable', family_size: '1',
    criminal_flag: false, biometric_notes: '',
  });
  const [registering, setRegistering] = useState(false);
  const [regResult,   setRegResult]   = useState<any>(null);

  useEffect(() => {
    getDashboard().then(r => setDashboard(r.data)).catch(() => {});
    getScanLogs().then(r => setScanLogs(r.data)).catch(() => {});
    getRefugees().then(r => setRefugees(r.data)).catch(() => {});
    if (isCommandOfficer) {
      getBorderStatistics().then(r => setBorderStats(r.data)).catch(() => {});
      getNGORequests().then(r => setNgoRequests(r.data)).catch(() => {});
    }
    countPendingSync().then(setPendingSync);

    // Emergency polling — every 5 seconds
    let prevEmergencies: Record<string, number> = {};
    const pollEmergencies = () => {
      getActiveEmergencies().then(r => {
        const regions: EmergencyRegion[] = r.data;
        regions.forEach(reg => {
          if (reg.is_emergency && !prevEmergencies[reg.region_name]) {
            setEmergencyAlerts(prev => [
              `⚠ EMERGENCY ALERT — Emergency declared at ${reg.region_name}`,
              ...prev,
            ].slice(0, 5));
          }
        });
        prevEmergencies = Object.fromEntries(regions.map(r => [r.region_name, r.is_emergency]));
        setEmergencies(regions);
      }).catch(() => {});
    };
    pollEmergencies();
    const emergencyPoll = setInterval(pollEmergencies, 5000);

    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    const feed = setInterval(() => setFeedIdx(i => (i + 1) % LIVE_FEED.length), 3000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(feed);
      clearInterval(emergencyPoll);
    };
  }, []);

  useEffect(() => {
    if (borderTab === 'travellers') getAllTravellers().then(r => setTravellers(r.data)).catch(() => {});
    if (borderTab === 'alerts')     getAlerts().then(r => setAlerts(r.data)).catch(() => {});
    if (borderTab === 'refugees')   getRefugees().then(r => setRefugees(r.data)).catch(() => {});
  }, [borderTab]);

  useEffect(() => {
    if (commandTab === 'alerts')   getAlerts().then(r => setAlerts(r.data)).catch(() => {});
    if (commandTab === 'refugees') getRefugees().then(r => setRefugees(r.data)).catch(() => {});
    if (commandTab === 'ngo')      getNGORequests().then(r => setNgoRequests(r.data)).catch(() => {});
    if (commandTab === 'activity') getScanLogs().then(r => setScanLogs(r.data)).catch(() => {});
  }, [commandTab]);

  const handleScan = useCallback(async () => {
    if (!scanInput.trim()) return;
    setScanning(true); setScanResult(null);
    try {
      if (!isOnline) {
        const cached = await lookupOfflineQR(scanInput.trim());
        const result = cached
          ? { ...cached, offline: true, result: cached.flag === 'green' ? 'cleared' : 'denied' }
          : { flag: 'black', result: 'not_found', offline: true, name: 'Not in cache' };
        setScanResult(result);
        // Store log offline
        await addOfflineScanLog({
          border_id: scanInput.trim(),
          traveller_name: result.name || 'Unknown',
          result: result.result || 'error',
          flag: result.flag || 'black',
        });
        setPendingSync(await countPendingSync());
      } else {
        const { data } = await scanQR(scanInput.trim());
        setScanResult(data);
        // Cache the result for offline use
        if (data.name) {
          await cacheQRRecord({
            border_id: scanInput.trim(),
            name: data.name,
            flag: data.flag,
            nationality: data.nationality || '',
            visa_type: data.visa_type,
            fraud_type: data.reason,
          });
        }
        getScanLogs().then(r => setScanLogs(r.data));
      }
    } catch (err: any) {
      setScanResult({ flag: 'black', result: 'error', message: err.response?.data?.error || 'Scan failed' });
    } finally { setScanning(false); }
  }, [scanInput, isOnline]);

  const handleRegisterRefugee = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true); setRegResult(null);
    const payload = {
      name:             regForm.name,
      country_of_origin: regForm.country_of_origin,
      origin_country:   regForm.country_of_origin,
      dob:              regForm.dob,
      age:              parseInt(regForm.age) || 0,
      entry_checkpoint: regForm.entry_checkpoint,
      assigned_ngo:     regForm.assigned_ngo || '',
      health_condition: regForm.health_condition,
      family_size:      parseInt(regForm.family_size) || 1,
      family_members:   parseInt(regForm.family_size) || 1,
      criminal_flag:    regForm.criminal_flag,
      criminal_record:  regForm.criminal_flag,
      biometric_notes:  regForm.biometric_notes,
      biometric_id:     regForm.biometric_notes,
    };
    try {
      if (!isOnline) {
        const rec = await addOfflineRefugee(payload);
        await addOfflineNGORequest({
          refugee_temp_id: (rec as any).temp_id,
          refugee_name: regForm.name,
          ngo_name: regForm.assigned_ngo || 'Auto-Assign',
        });
        setPendingSync(await countPendingSync());
        setRegResult({ temp_id: (rec as any).temp_id, status: 'saved_offline', assigned_ngo: 'Pending sync' });
      } else {
        const { data } = await registerRefugee(payload);
        setRegResult(data);
        getRefugees().then(r => setRefugees(r.data));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Registration failed — check backend is running';
      setRegResult({ error: msg });
    } finally { setRegistering(false); }
  }, [regForm, isOnline]);

  // Derived stats
  const totalCleared    = Object.values(CP_STATS).reduce((a, b) => a + b.cleared, 0);
  const totalFlagged    = Object.values(CP_STATS).reduce((a, b) => a + b.flagged, 0);
  const totalImmigrants = Object.values(CP_STATS).reduce((a, b) => a + b.immigrants, 0);

  const officerCp = user?.user_id?.includes('BSF') ? 'Wagah, Punjab'
    : user?.user_id?.includes('IB') ? 'Nathu La, Sikkim'
    : user?.user_id?.includes('CISF') ? 'Petrapole, West Bengal'
    : user?.user_id?.includes('SSB') ? 'Raxaul, Bihar'
    : 'Delhi Airport';

  const myCpStats = CP_STATS[officerCp] || { cleared: 0, flagged: 0, vehicles: 0, immigrants: 0 };

  const filteredTravellers = travellers.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.passport_number.toLowerCase().includes(search.toLowerCase()) ||
    (t.nationality || '').toLowerCase().includes(search.toLowerCase())
  );

  const SAFFRON = '#FF9933';
  const SIDEBAR_BG = '#0f172a';

  // ═══════════════════════════════════════════════════════
  // BORDER OFFICER VIEW
  // ═══════════════════════════════════════════════════════
  if (isBorderOfficer) {
    const BORDER_TABS = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard'      },
      { id: 'scanner',   icon: '🔲', label: 'QR Scanner'     },
      { id: 'travellers',icon: '👥', label: 'Traveller DB'   },
      { id: 'alerts',    icon: '🚨', label: `Alerts${alerts.length ? ` (${alerts.length})` : ''}` },
      { id: 'refugees',  icon: '🏕️', label: 'Refugees'       },
      { id: 'register',  icon: '➕', label: 'Register Refugee'},
    ];

    return (
      <div style={{ display: 'flex', height: 'calc(100vh - 62px)', fontFamily: "'Inter','Source Sans Pro',system-ui,sans-serif" }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: 224, background: SIDEBAR_BG, flexShrink: 0,
          display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👮</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{user?.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{user?.user_id}</div>
              </div>
            </div>
            <div style={{ background: '#b91c1c', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: 1.2, display: 'inline-block', marginBottom: 6 }}>
              BORDER OFFICER · CLASSIFIED
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>📍</span><span>{officerCp}</span>
            </div>
          </div>

          <SidebarNav tabs={BORDER_TABS as any} active={borderTab} onSelect={t => setBorderTab(t as BorderTab)} color="#b91c1c" />

          {/* Offline status footer */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? '#22c55e' : '#ef4444', boxShadow: isOnline ? '0 0 5px #22c55e' : '0 0 5px #ef4444' }} />
              <span style={{ fontSize: 10, color: isOnline ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                {isOnline ? 'ONLINE — LIVE DATA' : 'OFFLINE — CACHED'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              {pendingSync > 0 ? `⚠ ${pendingSync} pending sync` : '✓ All records synced'}
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div style={{ flex: 1, overflow: 'auto', background: '#F5F6FA' }}>

          {/* Emergency Alert Banner */}
          {emergencyAlerts.length > 0 && (
            <div style={{ background: '#C62828', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 700 }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <span>{emergencyAlerts[0]}</span>
              <button onClick={() => setEmergencyAlerts([])} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 5, padding: '2px 10px', cursor: 'pointer', fontSize: 12 }}>Dismiss</button>
            </div>
          )}

          {/* DASHBOARD TAB */}
          {borderTab === 'dashboard' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Border Control Dashboard</h2>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
                    {new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })} · {officerCp}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 14px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626' }} />
                  <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>LIVE MONITORING</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
                <StatCard label="Total Crossings Today"  value={totalCleared.toLocaleString('en-IN')}  color="#2E7D32" icon="✅" sub="All checkpoints"  trend="↑ 4.2% vs yesterday" />
                <StatCard label="Immigrants Processed"   value={totalImmigrants}                        color="#7c3aed" icon="🏳️" sub="Registered today" trend="↑ 2 new today" />
                <StatCard label="Flagged / Blocked"      value={totalFlagged}                            color="#C62828" icon="🚨" sub="Security alerts"   trend="⚠ 3 high priority" />
                <StatCard label="Refugees Tracked"       value={refugees.length}                         color="#0284c7" icon="🏕️" sub="NGO assigned" />
              </div>

              {/* My checkpoint stats */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 18, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Your Checkpoint — {officerCp}</h3>
                    <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Personal scan history and station activity</p>
                  </div>
                  <span style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                    YOUR STATION
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { label: 'Travellers Cleared', value: myCpStats.cleared.toLocaleString('en-IN'), color: '#2E7D32', icon: '✅' },
                    { label: 'Travellers Flagged', value: myCpStats.flagged, color: '#C62828', icon: '🚨' },
                    { label: 'Vehicles Processed', value: myCpStats.vehicles > 0 ? myCpStats.vehicles.toLocaleString('en-IN') : 'N/A', color: '#0284c7', icon: '🚛' },
                    { label: 'Immigrants Today',   value: myCpStats.immigrants, color: '#7c3aed', icon: '🏳️' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', borderLeft: `4px solid ${s.color}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live feed + scan history */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>🔴 Live Crossing Feed</h3>
                    <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '2px 8px', borderRadius: 4 }}>LIVE</span>
                  </div>
                  {LIVE_FEED.map((item, i) => {
                    const isTop = i === feedIdx % LIVE_FEED.length;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 7, marginBottom: 4,
                        background: isTop ? (item.status === 'cleared' ? '#f0fdf4' : '#fef2f2') : '#f8fafc',
                        border: isTop ? `1px solid ${item.status === 'cleared' ? '#bbf7d0' : '#fecaca'}` : '1px solid transparent',
                        transition: 'all 0.3s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', width: 36 }}>{item.time}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{item.from} · {item.visa}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: item.status === 'cleared' ? '#dcfce7' : '#fee2e2',
                          color: item.status === 'cleared' ? '#15803d' : '#b91c1c',
                        }}>{item.status === 'cleared' ? '✓ CLEARED' : '✗ FLAGGED'}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>Your QR Scan History</h3>
                  {scanLogs.length ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr style={{ background: '#f8fafc' }}>
                        {['Border ID','Traveller','Time','Result'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {scanLogs.slice(0, 8).map((log, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 10, color: '#475569' }}>{log.border_id}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 500 }}>{log.traveller_name || '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(log.timestamp).toLocaleTimeString('en-IN')}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: log.flag === 'green' ? '#f0fdf4' : '#fef2f2', color: log.flag === 'green' ? '#15803d' : '#b91c1c' }}>
                                {log.flag === 'green' ? '✓ PASS' : '✗ BLOCK'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                      <p style={{ fontSize: 13 }}>No scans yet. Use QR Scanner tab.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* All checkpoints table */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>🗺️ All India Checkpoint Activity — Today</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['Checkpoint','Cleared','Flagged','Immigrants','Vehicles','Alert Rate','Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {CHECKPOINTS.map(cp => {
                      const s = CP_STATS[cp] || { cleared: 0, flagged: 0, vehicles: 0, immigrants: 0 };
                      const rate = ((s.flagged / (s.cleared + s.flagged)) * 100).toFixed(2);
                      const isHigh = s.flagged > 15;
                      const isMine = cp === officerCp;
                      return (
                        <tr key={cp} style={{ borderBottom: '1px solid #f1f5f9', background: isMine ? '#fffbf5' : '#fff' }}>
                          <td style={{ padding: '10px 14px', fontWeight: isMine ? 800 : 500, color: '#0f172a' }}>
                            {isMine && <span style={{ marginRight: 6, fontSize: 10, color: SAFFRON, fontWeight: 800 }}>YOU →</span>}
                            {cp}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#2E7D32', fontWeight: 700 }}>{s.cleared.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', color: '#C62828', fontWeight: 700 }}>{s.flagged}</td>
                          <td style={{ padding: '10px 14px', color: '#7c3aed', fontWeight: 600 }}>{s.immigrants}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.vehicles > 0 ? s.vehicles.toLocaleString('en-IN') : '—'}</td>
                          <td style={{ padding: '10px 14px', color: isHigh ? '#C62828' : '#64748b', fontWeight: isHigh ? 700 : 400 }}>{rate}%</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: isHigh ? '#fef2f2' : '#f0fdf4', color: isHigh ? '#b91c1c' : '#15803d' }}>
                              {isHigh ? '⚠ HIGH ALERT' : '✓ NORMAL'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QR SCANNER TAB */}
          {borderTab === 'scanner' && (
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>E-Border ID Scanner</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Scan or enter a Border ID to verify entry clearance. Works offline using cached traveller data.</p>

              {!isOnline && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#92400e', marginBottom: 16, fontWeight: 600 }}>
                  ⚠️ OFFLINE MODE — Scanning against cached records. Logs stored locally until sync.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
                <div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                    <div style={{ width: 150, height: 150, margin: '0 auto 16px', border: '3px solid #b91c1c', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', position: 'relative', overflow: 'hidden' }}>
                      <style>{`@keyframes scanLine{0%,100%{top:8px}50%{top:128px}}`}</style>
                      <div style={{ position: 'absolute', width: '85%', height: 2, background: 'linear-gradient(90deg,transparent,#b91c1c,transparent)', animation: 'scanLine 2s ease-in-out infinite' }} />
                      <span style={{ fontSize: 44, opacity: 0.6 }}>🔲</span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>Enter or paste a Border ID below</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input value={scanInput} onChange={e => setScanInput(e.target.value)}
                        placeholder="EBI-P8821456X-2024-WA"
                        onKeyDown={e => e.key === 'Enter' && handleScan()}
                        style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
                      />
                      <button onClick={handleScan} disabled={scanning} style={{ background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {scanning ? '...' : 'SCAN'}
                      </button>
                    </div>

                    {scanResult && (
                      <div style={{ padding: 16, borderRadius: 10, background: scanResult.flag === 'green' ? '#f0fdf4' : '#0f172a', border: `2px solid ${scanResult.flag === 'green' ? '#86efac' : '#ef4444'}` }}>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, color: scanResult.flag === 'green' ? '#15803d' : '#ef4444' }}>
                          {scanResult.flag === 'green' ? '✅ GREEN FLAG — ENTRY PERMITTED' : '🚫 BLACK FLAG — ENTRY DENIED'}
                        </div>
                        {scanResult.offline && <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 8, fontWeight: 700 }}>⚡ OFFLINE RESULT — from cache</div>}
                        {scanResult.name      && <div style={{ color: scanResult.flag === 'green' ? '#166534' : '#fca5a5', fontSize: 13, marginBottom: 3 }}>👤 <strong>{scanResult.name}</strong></div>}
                        {scanResult.nationality && <div style={{ color: scanResult.flag === 'green' ? '#166534' : '#fca5a5', fontSize: 12, marginBottom: 3 }}>🌏 {scanResult.nationality}</div>}
                        {scanResult.visa_type  && <div style={{ color: scanResult.flag === 'green' ? '#166534' : '#fca5a5', fontSize: 12, marginBottom: 3 }}>🪪 Visa: {scanResult.visa_type}</div>}
                        {scanResult.reason && (
                          <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.12)', padding: '8px 12px', borderRadius: 6, fontWeight: 600 }}>
                            ⚠️ ALERT: {scanResult.reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Demo QR list */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Trial Border IDs for Demo</h3>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Click any ID to auto-fill the scanner.</p>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#15803d', letterSpacing: 1.2, marginBottom: 8, padding: '3px 10px', background: '#f0fdf4', borderRadius: 4, display: 'inline-block' }}>✅ VALID BORDER IDs</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {DEMO_QRS.filter(q => q.valid).map(qr => (
                        <button key={qr.id} onClick={() => { setScanInput(qr.id); setScanResult(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 18 }}>🟢</span>
                            <div>
                              <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{qr.id}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{qr.label} · {qr.visa}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>VALID ✓</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#b91c1c', letterSpacing: 1.2, marginBottom: 8, padding: '3px 10px', background: '#fef2f2', borderRadius: 4, display: 'inline-block' }}>🚫 FLAGGED BORDER IDs</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {DEMO_QRS.filter(q => !q.valid).map(qr => (
                        <button key={qr.id} onClick={() => { setScanInput(qr.id); setScanResult(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 18 }}>🔴</span>
                            <div>
                              <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{qr.id}</div>
                              <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>{qr.label}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c' }}>FLAGGED ✗</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TRAVELLERS TAB */}
          {borderTab === 'travellers' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Traveller Database</h2>
                  <p style={{ color: '#64748b', fontSize: 13 }}>{travellers.length} records · All checkpoints</p>
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍  Search name, passport, nationality…"
                  style={{ padding: '9px 14px', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13, width: 300, outline: 'none' }}
                />
              </div>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['Passport No.','Full Name','Nationality','Visa Type','Entry Point','Alert/Reason','Status'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredTravellers.map(t => (
                      <tr key={t.passport_number} style={{ borderBottom: '1px solid #f1f5f9', background: t.flag === 'black' ? '#fffbfb' : '#fff' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#334155', fontWeight: 600 }}>{t.passport_number}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{t.name}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{t.nationality}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{t.visa_type}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>{t.checkpoint}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: '#b91c1c', maxWidth: 180 }}>
                          {t.fraud_type ? <span style={{ background: '#fef2f2', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>{t.fraud_type}</span> : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 800, background: t.flag === 'green' ? '#f0fdf4' : '#fef2f2', color: t.flag === 'green' ? '#15803d' : '#b91c1c' }}>
                            {t.flag === 'green' ? '✓ CLEARED' : '✗ FLAGGED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
                  Showing {filteredTravellers.length} of {travellers.length} records
                </div>
              </div>
            </div>
          )}

          {/* ALERTS TAB */}
          {borderTab === 'alerts' && (
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>🚨 Security Alerts</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{alerts.length} flagged individuals — immediate action required</p>
              {alerts.map(t => (
                <div key={t.passport_number} style={{ background: '#fff', border: '1px solid #fecaca', borderLeft: '6px solid #dc2626', borderRadius: 12, padding: '18px 22px', marginBottom: 14, boxShadow: '0 2px 8px rgba(220,38,38,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 5 }}>
                        🚨 {t.name} <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: '#64748b', marginLeft: 10 }}>{t.passport_number}</span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>
                        🌏 {t.nationality} &nbsp;·&nbsp; 📍 {t.checkpoint} &nbsp;·&nbsp; 🪪 {t.visa_type} visa
                      </div>
                      <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600, background: '#fef2f2', padding: '8px 14px', borderRadius: 7, border: '1px solid #fecaca', display: 'inline-block' }}>
                        ⚠️ {t.fraud_type}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca' }}>⛔ BLOCKED</span>
                      <button style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#b91c1c', color: '#fff', border: 'none', cursor: 'pointer' }}>Alert BSF</button>
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No active security alerts</p>
                </div>
              )}
            </div>
          )}

          {/* REFUGEES TAB */}
          {borderTab === 'refugees' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Refugee Tracker</h2>
                  <p style={{ color: '#64748b', fontSize: 13 }}>{refugees.length} individuals registered</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: `${refugees.filter(r => r.status === 'active').length} Active`,         color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                    { label: `${refugees.filter(r => r.criminal_flag).length} Flagged`,              color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
                    { label: `${refugees.filter(r => r.status === 'under_investigation').length} Investigating`, color: '#92400e', bg: '#fef9c3', border: '#fde68a' },
                  ].map(b => (
                    <div key={b.label} style={{ background: b.bg, border: `1px solid ${b.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: b.color, fontWeight: 700 }}>{b.label}</div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['Temp ID','Full Name','Origin','Health','Family','Entry Point','Assigned NGO','Status'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {refugees.map(r => (
                      <tr key={r.temp_id} style={{ borderBottom: '1px solid #f1f5f9', background: r.criminal_flag ? '#fffbfb' : '#fff' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#334155' }}>{r.temp_id}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                          {r.name}
                          {r.criminal_flag ? <span style={{ marginLeft: 6, fontSize: 9, background: '#fef2f2', color: '#b91c1c', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>⚠ FLAGGED</span> : null}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{r.country_of_origin}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: r.health_condition === 'critical' ? '#fef2f2' : r.health_condition === 'injured' ? '#fef9c3' : '#f0fdf4',
                            color: r.health_condition === 'critical' ? '#b91c1c' : r.health_condition === 'injured' ? '#92400e' : '#15803d',
                          }}>{r.health_condition || 'stable'}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569', textAlign: 'center' }}>{r.family_size || 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>{r.entry_checkpoint}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>{r.assigned_ngo}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 800,
                            background: r.status === 'active' ? '#f0fdf4' : r.status === 'under_investigation' ? '#fef9c3' : '#f1f5f9',
                            color: r.status === 'active' ? '#15803d' : r.status === 'under_investigation' ? '#92400e' : '#475569',
                          }}>{r.status === 'under_investigation' ? '⚠ INVESTIGATING' : r.status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REGISTER REFUGEE TAB */}
          {borderTab === 'register' && (
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Register New Refugee</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                {!isOnline && <span style={{ color: '#F9A825', fontWeight: 700 }}>⚡ OFFLINE MODE — Will sync when internet reconnects. </span>}
                NGO will be auto-matched based on health condition and family size.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '500px 1fr', gap: 20 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
                  <form onSubmit={handleRegisterRefugee}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>FULL NAME *</label>
                        <input required value={regForm.name} onChange={e => setRegForm(f => ({...f, name: e.target.value}))}
                          placeholder="Ahmad Karimi" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>COUNTRY OF ORIGIN *</label>
                        <select value={regForm.country_of_origin} onChange={e => setRegForm(f => ({...f, country_of_origin: e.target.value}))}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff' }}>
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>DATE OF BIRTH</label>
                        <input type="date" value={regForm.dob} onChange={e => setRegForm(f => ({...f, dob: e.target.value}))}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>AGE</label>
                        <input type="number" value={regForm.age} onChange={e => setRegForm(f => ({...f, age: e.target.value}))}
                          placeholder="35" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>ENTRY CHECKPOINT *</label>
                        <select value={regForm.entry_checkpoint} onChange={e => setRegForm(f => ({...f, entry_checkpoint: e.target.value}))}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff' }}>
                          {CHECKPOINTS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>HEALTH CONDITION</label>
                        <select value={regForm.health_condition} onChange={e => setRegForm(f => ({...f, health_condition: e.target.value}))}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff' }}>
                          <option value="stable">Stable</option>
                          <option value="injured">Injured</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>FAMILY SIZE</label>
                        <input type="number" min="1" value={regForm.family_size} onChange={e => setRegForm(f => ({...f, family_size: e.target.value}))}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>ASSIGN NGO (optional — auto-match if blank)</label>
                        <select value={regForm.assigned_ngo} onChange={e => setRegForm(f => ({...f, assigned_ngo: e.target.value}))}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff' }}>
                          <option value="">Auto-Match Based on Profile</option>
                          {NGOS_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>BIOMETRIC NOTES</label>
                        <textarea value={regForm.biometric_notes} onChange={e => setRegForm(f => ({...f, biometric_notes: e.target.value}))}
                          rows={2} placeholder="Additional identification notes..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13, outline: 'none', resize: 'vertical' }} />
                      </div>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 14px' }}>
                          <input type="checkbox" checked={regForm.criminal_flag} onChange={e => setRegForm(f => ({...f, criminal_flag: e.target.checked}))}
                            style={{ width: 16, height: 16 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>⚠️ Criminal / Security Flag — Will trigger BSF Alert</span>
                        </label>
                      </div>
                    </div>
                    <button type="submit" disabled={registering} style={{ width: '100%', padding: '12px', background: SAFFRON, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                      {registering ? 'Registering...' : `${!isOnline ? '💾 Save Offline' : '✅ Register Refugee'}`}
                    </button>
                  </form>

                  {regResult && (
                    <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: regResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${regResult.error ? '#fecaca' : '#bbf7d0'}` }}>
                      {regResult.error
                        ? <div style={{ color: '#b91c1c', fontWeight: 700 }}>❌ {regResult.error}</div>
                        : <>
                          <div style={{ color: '#15803d', fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
                            {regResult.status === 'saved_offline' ? '💾 Saved Offline' : '✅ Refugee Registered'}
                          </div>
                          <div style={{ fontSize: 13, color: '#166534' }}>Temp ID: <strong style={{ fontFamily: 'monospace' }}>{regResult.temp_id}</strong></div>
                          <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>
                            Assigned NGO: <strong>{regResult.assigned_ngo}</strong>
                            {regResult.auto_matched && <span style={{ marginLeft: 8, fontSize: 10, background: '#dcfce7', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>AUTO-MATCHED</span>}
                          </div>
                        </>
                      }
                    </div>
                  )}
                </div>

                {/* NGO Matching Info */}
                <div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>🤖 Smart NGO Matching Logic</h4>
                    {[
                      { icon: '🏥', label: 'Critical / Injured health', ngo: 'Red Cross India', spec: 'Medical specialist NGO' },
                      { icon: '👨‍👩‍👧‍👦', label: 'Family size ≥ 4',          ngo: 'Helping Hands Foundation', spec: 'Family support specialist' },
                      { icon: '⚖️', label: 'Criminal flag',              ngo: 'UNHCR India',     spec: 'Legal support & protection' },
                      { icon: '🏠', label: 'Default / Single',           ngo: 'Refugee Aid India', spec: 'General shelter & support' },
                    ].map(m => (
                      <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 20 }}>{m.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{m.label}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{m.spec}</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: SAFFRON, background: '#fff7ed', padding: '3px 8px', borderRadius: 5, border: '1px solid #fed7aa' }}>{m.ngo}</div>
                      </div>
                    ))}
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>If first NGO is at capacity, system auto-forwards to next available NGO.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // COMMAND CENTER OFFICER VIEW
  // ═══════════════════════════════════════════════════════
  const CMD_TABS = [
    { id: 'analytics', icon: '📊', label: 'Analytics'     },
    { id: 'activity',  icon: '📋', label: 'Border Activity'},
    { id: 'alerts',    icon: '🚨', label: `Alerts${alerts.length ? ` (${alerts.length})` : ''}` },
    { id: 'refugees',  icon: '🏕️', label: 'Refugees'      },
    { id: 'ngo',       icon: '🤝', label: 'NGO Requests'  },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 62px)', fontFamily: "'Inter','Source Sans Pro',system-ui,sans-serif" }}>

      {/* ── Command Sidebar ── */}
      <div style={{ width: 224, background: '#1e1b4b', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#312e81' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#4c1d95', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎖️</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{user?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{user?.user_id}</div>
            </div>
          </div>
          <div style={{ background: '#6d28d9', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: 1.2, display: 'inline-block' }}>
            COMMAND CENTER OFFICER
          </div>
        </div>

        <SidebarNav tabs={CMD_TABS as any} active={commandTab} onSelect={t => setCommandTab(t as CommandTab)} color="#7c3aed" />

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#312e81', fontSize: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#a78bfa', fontWeight: 700 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
            INTERNET REQUIRED
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
            {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </div>
        </div>
      </div>

      {/* ── Command Content ── */}
      <div style={{ flex: 1, overflow: 'auto', background: '#F5F6FA' }}>

        {/* Emergency Alert Banner */}
        {emergencyAlerts.length > 0 && (
          <div style={{ background: '#C62828', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 700 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <span>{emergencyAlerts[0]}</span>
            <button onClick={() => setEmergencyAlerts([])} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 5, padding: '2px 10px', cursor: 'pointer', fontSize: 12 }}>Dismiss</button>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {commandTab === 'analytics' && (
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Command Center Analytics</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>Live border intelligence dashboard — {new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
              <StatCard label="Total Travellers Today"  value={(borderStats?.total_travellers_today || 31842).toLocaleString('en-IN')} color="#2E7D32" icon="✅" sub="All checkpoints" trend="↑ 4.2%" />
              <StatCard label="Suspicious Travellers"   value={borderStats?.suspicious_travellers || alerts.length || 15} color="#C62828" icon="🚨" sub="Flagged & blocked" trend="⚠ 3 critical" />
              <StatCard label="Refugees Registered"     value={borderStats?.refugees_registered || refugees.length} color="#7c3aed" icon="🏕️" sub="All NGOs combined" />
              <StatCard label="NGO Requests Pending"    value={borderStats?.ngo_requests_pending || ngoRequests.filter(r => r.status === 'PENDING').length} color={SAFFRON} icon="🤝" sub="Awaiting response" />
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Monthly refugee arrivals */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Refugee Arrivals per Month</h3>
                <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>2024 monthly registration trend</p>
                <BarChart
                  color="#7c3aed"
                  data={(borderStats?.monthly_refugee_arrivals || [
                    { month: '2024-01', count: 142 }, { month: '2024-02', count: 198 },
                    { month: '2024-03', count: 234 }, { month: '2024-04', count: 187 },
                    { month: '2024-05', count: 312 }, { month: '2024-06', count: 278 },
                  ]).map(d => ({ label: d.month, value: d.count }))}
                />
              </div>

              {/* Verification distribution */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Traveller Verification Distribution</h3>
                <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Result breakdown across all checkpoints</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  {(borderStats?.verification_distribution || [
                    { label: 'Cleared',  count: dashboard?.cleared || 10 },
                    { label: 'Flagged',  count: dashboard?.flagged || 15 },
                    { label: 'Pending',  count: dashboard?.pending || 0  },
                  ]).map(d => {
                    const total = (borderStats?.verification_distribution || [{ count: 25 }]).reduce((a, b) => a + b.count, 0) || 1;
                    const pct   = Math.round((d.count / total) * 100);
                    const color = d.label === 'Cleared' ? '#2E7D32' : d.label === 'Flagged' ? '#C62828' : '#F9A825';
                    return (
                      <div key={d.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{d.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color }}>{d.count} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 5, transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Checkpoint overview table */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>All India Checkpoint Activity</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Checkpoint','Cleared','Flagged','Immigrants','Alert Rate','Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {CHECKPOINTS.map(cp => {
                    const s = CP_STATS[cp] || { cleared: 0, flagged: 0, immigrants: 0 };
                    const rate = ((s.flagged / (s.cleared + s.flagged)) * 100).toFixed(2);
                    const isHigh = s.flagged > 15;
                    return (
                      <tr key={cp} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{cp}</td>
                        <td style={{ padding: '10px 14px', color: '#2E7D32', fontWeight: 700 }}>{s.cleared.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', color: '#C62828', fontWeight: 700 }}>{s.flagged}</td>
                        <td style={{ padding: '10px 14px', color: '#7c3aed' }}>{s.immigrants}</td>
                        <td style={{ padding: '10px 14px', color: isHigh ? '#C62828' : '#64748b', fontWeight: isHigh ? 700 : 400 }}>{rate}%</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: isHigh ? '#fef2f2' : '#f0fdf4', color: isHigh ? '#b91c1c' : '#15803d' }}>
                            {isHigh ? '⚠ HIGH ALERT' : '✓ NORMAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {commandTab === 'activity' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Border Activity Monitor</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Live QR scan logs from all checkpoints</p>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Border ID','Traveller','Officer','Time','Result'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {scanLogs.map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>{log.border_id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{log.traveller_name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>{log.officer_id}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: log.flag === 'green' ? '#f0fdf4' : '#fef2f2', color: log.flag === 'green' ? '#15803d' : '#b91c1c' }}>
                          {log.flag === 'green' ? '✓ CLEARED' : '✗ BLOCKED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!scanLogs.length && (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No scan activity yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ALERTS TAB (Command) */}
        {commandTab === 'alerts' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>🚨 Suspicious Traveller Alerts</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{alerts.length} flagged individuals requiring command review</p>
            {alerts.map(t => (
              <div key={t.passport_number} style={{ background: '#fff', border: '1px solid #fecaca', borderLeft: '6px solid #dc2626', borderRadius: 12, padding: '18px 22px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 5 }}>
                      🚨 {t.name} <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: '#64748b', marginLeft: 10 }}>{t.passport_number}</span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>
                      🌏 {t.nationality} &nbsp;·&nbsp; 📍 {t.checkpoint} &nbsp;·&nbsp; 🪪 {(t as any).visa_type} visa
                    </div>
                    <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600, background: '#fef2f2', padding: '8px 14px', borderRadius: 7, border: '1px solid #fecaca', display: 'inline-block' }}>
                      ⚠️ {t.fraud_type}
                    </div>
                  </div>
                  <span style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca' }}>⛔ BLOCKED</span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p>No active alerts</p>
              </div>
            )}
          </div>
        )}

        {/* REFUGEES TAB (Command) */}
        {commandTab === 'refugees' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Refugee Statistics</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{refugees.length} individuals registered across all entry points</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
              <StatCard label="Total Registered" value={refugees.length} color="#7c3aed" icon="🏕️" />
              <StatCard label="Criminal Flagged" value={refugees.filter(r => r.criminal_flag).length} color="#C62828" icon="⚠️" />
              <StatCard label="Under Investigation" value={refugees.filter(r => r.status === 'under_investigation').length} color="#F9A825" icon="🔍" />
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Temp ID','Name','Origin','Age','Health','Family','NGO','Status'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {refugees.map(r => (
                    <tr key={r.temp_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#334155' }}>{r.temp_id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                        {r.name}
                        {r.criminal_flag ? <span style={{ marginLeft: 6, fontSize: 9, background: '#fef2f2', color: '#b91c1c', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>⚠</span> : null}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{r.country_of_origin}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{r.age || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: r.health_condition === 'critical' ? '#fef2f2' : r.health_condition === 'injured' ? '#fef9c3' : '#f0fdf4',
                          color: r.health_condition === 'critical' ? '#b91c1c' : r.health_condition === 'injured' ? '#92400e' : '#15803d',
                        }}>{r.health_condition || 'stable'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', textAlign: 'center' }}>{r.family_size || 1}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>{r.assigned_ngo}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 800,
                          background: r.status === 'active' ? '#f0fdf4' : '#fef9c3',
                          color: r.status === 'active' ? '#15803d' : '#92400e',
                        }}>{r.status === 'under_investigation' ? '⚠ INVEST.' : r.status.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* NGO MONITORING TAB */}
        {commandTab === 'ngo' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>NGO Assignment Monitor</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              {ngoRequests.filter(r => r.status === 'PENDING').length} pending ·{' '}
              {ngoRequests.filter(r => r.status === 'ACCEPTED').length} accepted ·{' '}
              {ngoRequests.filter(r => r.status === 'REJECTED').length} rejected
            </p>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Refugee','Refugee ID','NGO','Attempt','Requested','Status'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {ngoRequests.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{req.refugee_name}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{req.refugee_temp_id}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{req.ngo_name}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', textAlign: 'center' }}>#{req.attempt_number}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{new Date(req.requested_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 800,
                          background: req.status === 'ACCEPTED' ? '#f0fdf4' : req.status === 'REJECTED' ? '#fef2f2' : '#fef9c3',
                          color: req.status === 'ACCEPTED' ? '#15803d' : req.status === 'REJECTED' ? '#b91c1c' : '#92400e',
                        }}>
                          {req.status === 'ACCEPTED' ? '✓ ACCEPTED' : req.status === 'REJECTED' ? '✗ REJECTED' : '⏳ PENDING'}
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
