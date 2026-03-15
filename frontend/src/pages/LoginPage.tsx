import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';

const ROLES: { id: Role; label: string; icon: string; placeholder: string; hint: string; desc: string }[] = [
  {
    id: 'officer', label: 'Officer', icon: '👮',
    placeholder: 'Government ID (e.g. BSF-2024-0042)',
    hint: 'Border: CISF-2024-0055 · FRRO-2024-0007 · SSB-2024-0033\nCommand: BSF-2024-0042 · IB-2024-0011',
    desc: 'Border Control & Command Center',
  },
  {
    id: 'traveller', label: 'Traveller', icon: '🛂',
    placeholder: 'Passport Number (e.g. P8821456X)',
    hint: 'P8821456X · JP2023998 · DE4410023 · AU7823001',
    desc: 'Traveller Self-Service Portal',
  },
  {
    id: 'ngo', label: 'NGO Worker', icon: '🤝',
    placeholder: 'NGO ID (e.g. NGO-REDCROSS-001)',
    hint: 'NGO-REDCROSS-001 · NGO-RAI-002 · NGO-HHF-003',
    desc: 'Humanitarian & Relief Operations',
  },
  {
    id: 'mea', label: 'MEA Officer', icon: '🏛️',
    placeholder: 'MEA ID (e.g. MEA-2024-0001)',
    hint: 'MEA-2024-0001',
    desc: 'Ministry of External Affairs',
  },
];

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate    = useNavigate();
  const [role,     setRole]     = useState<Role>('officer');
  const [userId,   setUserId]   = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const current = ROLES.find(r => r.id === role)!;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await login(role, userId.trim(), password);
      setUser({ token: data.token, role: data.role, name: data.name, user_id: data.user_id });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 50%, #0a1628 100%)',
      fontFamily: "'Inter', 'Source Sans Pro', system-ui, sans-serif",
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 32px', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#FF9933', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>🦁</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: 0.3 }}>
              SeemaKavatch
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
              Smart Border Management & Humanitarian Coordination System
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 10, color: 'rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          padding: '5px 12px', borderRadius: 6, letterSpacing: 0.5, fontWeight: 700,
        }}>
          MINISTRY OF HOME AFFAIRS · GOI
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', maxWidth: 900, width: '100%' }}>

          {/* Left — info panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 20 }}>
            <div>
              <div style={{ color: '#FF9933', fontSize: 11, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>
                🇮🇳 SEEMAKAVATCH IBMS v2.0
              </div>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1.3, marginBottom: 12 }}>
                India's Unified<br />Border Intelligence<br />Platform
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7 }}>
                Real-time border monitoring, traveller verification, refugee coordination,
                and humanitarian NGO management — all in one secure platform.
              </p>
            </div>

            {[
              { icon: '🛡️', label: 'Role-Based Access', desc: 'Border officers with offline capability · Command center with live intelligence' },
              { icon: '📡', label: 'Offline-First Design', desc: 'Border officers can operate without internet — sync when connectivity returns' },
              { icon: '🗺️', label: 'Live Border Map', desc: 'India strategic intelligence map with ICPs, airports, seaports & drone zones' },
              { icon: '🤝', label: 'Smart NGO Matching', desc: 'AI-based refugee-to-NGO assignment with auto-forwarding on rejection' },
            ].map(f => (
              <div key={f.label} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{f.label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right — Login form */}
          <div style={{
            width: 400, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: '28px 28px 24px',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{current.icon}</div>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                Secure Portal Login
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                Authorised personnel only — {current.desc}
              </p>
            </div>

            {/* Role Tabs */}
            <div style={{
              display: 'flex', background: 'rgba(0,0,0,0.3)',
              borderRadius: 10, padding: 3, marginBottom: 20, gap: 2,
            }}>
              {ROLES.map(r => (
                <button key={r.id} onClick={() => { setRole(r.id); setUserId(''); setError(''); }} style={{
                  flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: r.id === role ? 800 : 500,
                  background: r.id === role ? '#FF9933' : 'transparent',
                  color: r.id === role ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                  letterSpacing: 0.3,
                }}>
                  {r.icon} {r.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>
                  {role === 'officer' ? 'GOVERNMENT ID' : role === 'traveller' ? 'PASSPORT NUMBER' : 'NGO WORKER ID'}
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder={current.placeholder}
                  required
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 13,
                    outline: 'none', fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5', borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, marginBottom: 14, fontWeight: 600,
                }}>⚠ {error}</div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px 20px',
                background: loading ? 'rgba(255,153,51,0.5)' : '#FF9933',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: 0.5, transition: 'all 0.2s',
              }}>
                {loading ? 'Authenticating...' : `Login as ${current.label} →`}
              </button>
            </form>

            {/* Demo hint */}
            <div style={{
              marginTop: 18, padding: '12px 14px',
              background: 'rgba(255,153,51,0.07)', border: '1px solid rgba(255,153,51,0.15)',
              borderRadius: 10,
            }}>
              <div style={{ color: '#FF9933', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
                🔑 Demo credentials — password: Demo@1234
              </div>
              <pre style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'monospace' }}>
                {current.hint}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
