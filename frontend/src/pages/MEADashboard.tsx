import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getActiveEmergencies, toggleEmergency, getNGORequests, getRefugees } from '../utils/api';
import type { EmergencyRegion, NGORequest, Refugee } from '../types';

declare global { interface Window { L: any; } }

const SAFFRON = '#FF9933';

const BORDER_REGIONS = [
  { id: 'Punjab Border',      label: 'Punjab Border',      lat: 31.1,  lng: 75.3,  description: 'Pakistan Border — Wagah/Attari ICP' },
  { id: 'Rajasthan Border',   label: 'Rajasthan Border',   lat: 27.0,  lng: 71.5,  description: 'Pakistan Border — Desert region' },
  { id: 'Gujarat Border',     label: 'Gujarat Border',     lat: 23.8,  lng: 70.5,  description: 'Pakistan / Sea Border' },
  { id: 'Kashmir Sector',     label: 'Kashmir Sector',     lat: 34.0,  lng: 74.5,  description: 'LoC — Pakistan & China border' },
  { id: 'Arunachal Border',   label: 'Arunachal Border',   lat: 27.5,  lng: 93.5,  description: 'China — McMahon Line' },
  { id: 'West Bengal Border', label: 'West Bengal Border', lat: 23.2,  lng: 88.9,  description: 'Bangladesh Border — Petrapole ICP' },
  { id: 'Manipur Border',     label: 'Manipur Border',     lat: 24.2,  lng: 94.3,  description: 'Myanmar Border — Moreh ICP' },
];

type Tab = 'map' | 'emergency' | 'statistics' | 'alerts';

export default function MEADashboard() {
  const { user } = useAuth();
  const [tab, setTab]                     = useState<Tab>('map');
  const [regions, setRegions]             = useState<EmergencyRegion[]>([]);
  const [ngoRequests, setNgoRequests]     = useState<NGORequest[]>([]);
  const [refugees, setRefugees]           = useState<Refugee[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [toggling, setToggling]           = useState<string | null>(null);
  const [toggleMsg, setToggleMsg]         = useState('');

  const mapRef     = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevEmRef  = useRef<Record<string, number>>({});

  const makeIcon = (isEm: boolean) => {
    if (!window.L) return null;
    const color = isEm ? '#C62828' : '#138808';
    const pulse = isEm
      ? `animation:meaPulse 1.5s infinite;box-shadow:0 0 0 0 ${color}66;`
      : 'box-shadow:0 2px 6px rgba(0,0,0,0.35);';
    return window.L.divIcon({
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid #fff;${pulse}"></div>`,
      className: '', iconSize: [18, 18], iconAnchor: [9, 9],
    });
  };

  const updateMapMarkers = useCallback((regs: EmergencyRegion[]) => {
    if (!leafletRef.current || !window.L) return;
    regs.forEach(reg => {
      const marker = markersRef.current[reg.region_name];
      if (!marker) return;
      const isEm = !!reg.is_emergency;
      const icon = makeIcon(isEm);
      if (icon) marker.setIcon(icon);
      const regionDef = BORDER_REGIONS.find(b => b.id === reg.region_name);
      const color = isEm ? '#C62828' : '#15803d';
      const bgColor = isEm ? '#fef2f2' : '#f0fdf4';
      const borderColor = isEm ? '#fecaca' : '#bbf7d0';
      marker.setPopupContent(`
        <div style="font-family:Inter,sans-serif;min-width:200px;padding:4px;">
          <div style="font-weight:800;font-size:14px;color:${color};margin-bottom:5px;">
            ${isEm ? '🚨' : '🛡️'} ${reg.region_name}
          </div>
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;">${regionDef?.description || ''}</div>
          <div style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800;background:${bgColor};color:${color};border:1px solid ${borderColor};">
            ${isEm ? 'EMERGENCY ACTIVE' : 'NORMAL OPERATIONS'}
          </div>
          ${reg.declared_at && isEm ? `<div style="font-size:10px;color:#94a3b8;margin-top:6px;">Since: ${new Date(reg.declared_at).toLocaleString('en-IN')}</div>` : ''}
        </div>
      `);
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [emRes, ngoRes, refRes] = await Promise.all([
        getActiveEmergencies(), getNGORequests(), getRefugees(),
      ]);
      const newRegions: EmergencyRegion[] = emRes.data;
      newRegions.forEach(r => {
        if (r.is_emergency && !prevEmRef.current[r.region_name]) {
          const msg = `⚠ EMERGENCY at ${r.region_name} — ${new Date().toLocaleTimeString('en-IN')}`;
          setNotifications(n => [msg, ...n].slice(0, 10));
        }
      });
      prevEmRef.current = Object.fromEntries(newRegions.map(r => [r.region_name, r.is_emergency]));
      setRegions(newRegions);
      setNgoRequests(ngoRes.data);
      setRefugees(refRes.data);
      updateMapMarkers(newRegions);
    } catch { /* silent */ }
  }, [updateMapMarkers]);

  const initMap = useCallback(() => {
    if (leafletRef.current || !mapRef.current || !window.L) return;
    const L = window.L;
    if (!document.getElementById('mea-style')) {
      const s = document.createElement('style');
      s.id = 'mea-style';
      s.textContent = `@keyframes meaPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}`;
      document.head.appendChild(s);
    }
    const map = L.map(mapRef.current, { center: [22, 80], zoom: 5, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 10 }).addTo(map);
    leafletRef.current = map;

    BORDER_REGIONS.forEach(region => {
      const em = regions.find(r => r.region_name === region.id);
      const isEm = !!em?.is_emergency;
      const icon = makeIcon(isEm) || L.divIcon({ html: '<div style="width:16px;height:16px;border-radius:50%;background:#138808;border:2px solid #fff;"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
      const marker = L.marker([region.lat, region.lng], { icon })
        .addTo(map)
        .bindPopup(`<div style="font-family:Inter,sans-serif;"><b>🛡️ ${region.id}</b><br/><small style="color:#64748b">${region.description}</small></div>`);
      L.marker([region.lat, region.lng], {
        icon: L.divIcon({
          html: `<div style="background:rgba(15,32,64,0.88);color:#fff;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;white-space:nowrap;margin-top:12px;">${region.label}</div>`,
          className: '', iconAnchor: [-2, 8],
        }), interactive: false,
      }).addTo(map);
      markersRef.current[region.id] = marker;
    });

    const checkpoints = [
      { n: 'Wagah', lat: 31.60, lng: 74.57 }, { n: 'Petrapole', lat: 23.01, lng: 88.89 },
      { n: 'Moreh', lat: 24.26, lng: 94.27 }, { n: 'Raxaul', lat: 26.99, lng: 84.84 },
      { n: 'Delhi Airport', lat: 28.56, lng: 77.10 }, { n: 'Mumbai Port', lat: 18.95, lng: 72.84 },
      { n: 'Nathu La', lat: 27.39, lng: 88.83 },
    ];
    checkpoints.forEach(cp => {
      L.circleMarker([cp.lat, cp.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: SAFFRON, fillOpacity: 1 })
        .addTo(map).bindTooltip(cp.n, { permanent: false, direction: 'top' });
    });

    if (regions.length > 0) updateMapMarkers(regions);
  }, [regions, updateMapMarkers]);

  // Init map when tab switches to map
  useEffect(() => {
    if (tab !== 'map') return;
    const tryInit = () => {
      if (window.L) { setTimeout(initMap, 150); return; }
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = () => setTimeout(initMap, 150);
      document.head.appendChild(js);
    };
    tryInit();
    return () => {
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; markersRef.current = {}; }
    };
  }, [tab]);

  useEffect(() => { if (regions.length > 0) updateMapMarkers(regions); }, [regions, updateMapMarkers]);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(loadData, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadData]);

  const handleToggle = async (region: EmergencyRegion) => {
    const activate = !region.is_emergency;
    setToggling(region.region_name);
    setToggleMsg('');
    try {
      await toggleEmergency(region.region_name, activate);
      setToggleMsg(activate ? `🚨 Emergency activated for ${region.region_name}` : `✅ Resolved: ${region.region_name}`);
      if (activate) setNotifications(n => [`⚠ EMERGENCY at ${region.region_name} — ${new Date().toLocaleTimeString('en-IN')}`, ...n].slice(0, 10));
      await loadData();
    } catch (err: any) {
      setToggleMsg(`❌ Failed: ${err?.response?.data?.error || 'Server error. Check backend is running.'}`);
    } finally {
      setToggling(null);
      setTimeout(() => setToggleMsg(''), 5000);
    }
  };

  const emergencyCount = regions.filter(r => r.is_emergency).length;

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'map',        icon: '🗺️', label: 'Border Map' },
    { id: 'emergency',  icon: '🚨', label: `Emergency Control${emergencyCount ? ` (${emergencyCount})` : ''}` },
    { id: 'statistics', icon: '📊', label: 'Statistics' },
    { id: 'alerts',     icon: '🔔', label: `Alerts${notifications.length ? ` (${notifications.length})` : ''}` },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 62px)', fontFamily: "'Inter','Source Sans Pro',system-ui,sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 230, background: '#0f2040', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#0a1628' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: SAFFRON, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏛️</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{user?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{user?.user_id}</div>
            </div>
          </div>
          <div style={{ background: SAFFRON, color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: 1.2, display: 'inline-block' }}>MEA OFFICER</div>
          {emergencyCount > 0 && (
            <div style={{ marginTop: 8, background: '#C62828', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>🚨 {emergencyCount} ACTIVE EMERGENCY</div>
          )}
        </div>
        <div style={{ padding: '10px 0', flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', width: '100%', textAlign: 'left',
              background: tab === t.id ? 'rgba(255,153,51,0.2)' : 'transparent',
              borderLeft: `3px solid ${tab === t.id ? SAFFRON : 'transparent'}`,
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.45)',
              fontWeight: tab === t.id ? 700 : 400, fontSize: 13, border: 'none', cursor: 'pointer',
              borderRight: 'none', borderTop: 'none', borderBottom: 'none', borderStyle: 'solid',
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0a1628' }}>
          <div style={{ fontSize: 11, color: SAFFRON, fontWeight: 700 }}>MINISTRY OF EXTERNAL AFFAIRS</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', background: '#EAF4FF' }}>
        {toggleMsg && (
          <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: toggleMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
            color: toggleMsg.startsWith('✅') ? '#15803d' : '#C62828',
            border: `1px solid ${toggleMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
          }}>{toggleMsg}</div>
        )}

        {emergencyCount > 0 && (
          <div style={{ background: '#C62828', color: '#fff', padding: '10px 24px', display: 'flex', gap: 12, fontSize: 13, fontWeight: 700, alignItems: 'center' }}>
            <span>🚨</span><span>EMERGENCY ACTIVE:</span>
            <span>{regions.filter(r => r.is_emergency).map(r => r.region_name).join(' · ')}</span>
          </div>
        )}

        {/* MAP TAB */}
        {tab === 'map' && (
          <div style={{ padding: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>🗺️ India Border Intelligence Map</h2>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 14 }}>Live border region status · 🟢 Normal · 🔴 Emergency</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Active Emergencies',   value: emergencyCount,                                         color: emergencyCount > 0 ? '#C62828' : '#2E7D32', icon: '🚨' },
                { label: 'Refugees Registered',  value: refugees.length,                                        color: '#7c3aed', icon: '🏕️' },
                { label: 'Pending NGO Requests', value: ngoRequests.filter(r => r.status === 'PENDING').length, color: '#F9A825', icon: '⏳' },
                { label: 'Border Regions',        value: BORDER_REGIONS.length,                                  color: '#0284c7', icon: '🛡️' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${c.color}`, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 600 }}>{c.icon} {c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
              <div style={{ background: '#0f2040', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>🗺️ India Border Surveillance — MEA Command View</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                  <span style={{ color: '#86efac' }}>🟢 Normal</span>
                  <span style={{ color: '#fca5a5' }}>🔴 Emergency</span>
                  <span style={{ color: SAFFRON }}>🟠 Checkpoint</span>
                </div>
              </div>
              <div ref={mapRef} style={{ height: 500, width: '100%' }} />
            </div>
          </div>
        )}

        {/* EMERGENCY CONTROL TAB */}
        {tab === 'emergency' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>🚨 Emergency Border Control Panel</h2>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>Toggle emergency mode. Officer dashboards are notified within 5 seconds.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              {BORDER_REGIONS.map(region => {
                const em = regions.find(r => r.region_name === region.id);
                const isEmergency = !!em?.is_emergency;
                const isLoading = toggling === region.id;
                return (
                  <div key={region.id} style={{
                    background: isEmergency ? '#fff5f5' : '#fff', borderRadius: 14, padding: '20px 24px',
                    border: `2px solid ${isEmergency ? '#fecaca' : '#e2e8f0'}`,
                    boxShadow: isEmergency ? '0 0 0 3px rgba(198,40,40,0.08)' : '0 1px 6px rgba(0,0,0,0.06)',
                    transition: 'all 0.3s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>{isEmergency ? '🚨' : '🛡️'} {region.id}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{region.description}</div>
                      </div>
                      <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: isEmergency ? '#C62828' : '#2E7D32', color: '#fff' }}>
                        {isEmergency ? 'EMERGENCY' : 'NORMAL'}
                      </div>
                    </div>
                    {isEmergency && em?.declared_at && (
                      <div style={{ fontSize: 11, color: '#b91c1c', background: '#fef2f2', padding: '6px 10px', borderRadius: 6, marginBottom: 12 }}>
                        ⏱ Declared: {new Date(em.declared_at).toLocaleString('en-IN')}{em.declared_by ? ` · By: ${em.declared_by}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        onClick={() => !isLoading && handleToggle(em ?? { id: 0, region_name: region.id, is_emergency: 0 })}
                        style={{ width: 56, height: 28, borderRadius: 14, background: isEmergency ? '#C62828' : '#cbd5e1', position: 'relative', cursor: isLoading ? 'wait' : 'pointer', transition: 'background 0.3s', opacity: isLoading ? 0.6 : 1 }}
                      >
                        <div style={{ position: 'absolute', top: 3, left: isEmergency ? 31 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isEmergency ? '#C62828' : '#475569' }}>
                        {isLoading ? '⏳ Updating...' : isEmergency ? 'Emergency Active — click to resolve' : 'Normal — click to activate emergency'}
                      </span>
                    </div>
                    {isEmergency && (
                      <div style={{ marginTop: 10, fontSize: 11, color: '#7c3aed', background: '#f5f3ff', padding: '5px 10px', borderRadius: 6 }}>
                        📢 Officers notified · Map marker pulsing red
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STATISTICS TAB */}
        {tab === 'statistics' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>📊 Border & Refugee Statistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Total Refugees',      value: refugees.length,                                         color: '#7c3aed', icon: '🏕️' },
                { label: 'Active Cases',         value: refugees.filter(r => r.status === 'active').length,      color: '#2E7D32', icon: '✅' },
                { label: 'Criminal Flagged',     value: refugees.filter(r => r.criminal_flag).length,            color: '#C62828', icon: '⚠️' },
                { label: 'Pending NGO',          value: ngoRequests.filter(r => r.status === 'PENDING').length,  color: '#F9A825', icon: '⏳' },
                { label: 'NGO Accepted',         value: ngoRequests.filter(r => r.status === 'ACCEPTED').length, color: '#2E7D32', icon: '🤝' },
                { label: 'Emergency Regions',    value: emergencyCount,                                          color: emergencyCount > 0 ? '#C62828' : '#64748b', icon: '🚨' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', borderTop: `3px solid ${c.color}`, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 5, fontWeight: 600 }}>{c.icon} {c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Recent Refugee Registrations</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Temp ID','Name','Origin','Age','Health','Assigned NGO','Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {refugees.slice(0, 15).map(r => (
                    <tr key={r.temp_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#334155' }}>{r.temp_id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{r.name}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{r.country_of_origin}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{r.age || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: r.health_condition==='critical'?'#fef2f2':r.health_condition==='injured'?'#fef9c3':'#f0fdf4',
                          color: r.health_condition==='critical'?'#b91c1c':r.health_condition==='injured'?'#92400e':'#15803d',
                        }}>{r.health_condition||'stable'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>{r.assigned_ngo}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 800,
                          background: r.status==='active'?'#f0fdf4':'#fef9c3',
                          color: r.status==='active'?'#15803d':'#92400e',
                        }}>{r.status?.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === 'alerts' && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>🔔 Emergency Notifications</h2>
                <p style={{ color: '#475569', fontSize: 13, marginTop: 3 }}>Alerts generated when emergency mode is toggled</p>
              </div>
              {notifications.length > 0 && (
                <button onClick={() => setNotifications([])} style={{ padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: '#64748b' }}>Clear All</button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
                <p style={{ fontWeight: 600 }}>No emergency notifications</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Activate emergency mode to generate alerts.</p>
              </div>
            ) : notifications.map((msg, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 12, border: '1px solid #fecaca', borderLeft: '5px solid #C62828', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 24 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#C62828' }}>{msg}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Broadcast to all officer dashboards</div>
                </div>
              </div>
            ))}
            {emergencyCount > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>Currently Active Emergencies</h3>
                {regions.filter(r => r.is_emergency).map(r => (
                  <div key={r.region_name} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', marginBottom: 10, border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#C62828', fontSize: 14 }}>🚨 {r.region_name}</div>
                      {r.declared_at && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Since: {new Date(r.declared_at).toLocaleString('en-IN')}</div>}
                    </div>
                    <button onClick={() => handleToggle(r)} disabled={toggling === r.region_name}
                      style={{ padding: '7px 16px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: toggling === r.region_name ? 0.6 : 1 }}>
                      ✓ Resolve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
