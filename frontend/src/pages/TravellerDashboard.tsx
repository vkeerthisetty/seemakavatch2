import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { submitApplication, runVerification, getMyStatus } from '../utils/api';
import type { VerificationResult } from '../types';

type Tab = 'apply' | 'verify' | 'eid';

export default function TravellerDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('apply');
  const [form, setForm] = useState({ nationality: '', purpose: 'Tourism', duration: '', notes: '' });
  const [passportFile, setPassportFile] = useState<string | null>(null);
  const [visaFile, setVisaFile] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResults, setVerifyResults] = useState<VerificationResult[]>([]);
  const [verifyDone, setVerifyDone] = useState(false);
  const [verifyPassed, setVerifyPassed] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [myStatus, setMyStatus] = useState<any>(null);

  useEffect(() => {
    getMyStatus().then(r => setMyStatus(r.data)).catch(() => {});
  }, []);

  const CHECKS = [
    'Passport validity (6-month rule)',
    'Biochip integrity verification',
    'FRRO database cross-check',
    'Interpol / criminal database scan',
    'Red alerts & lookout notices',
    'Visa authenticity & date validation',
    'AI/ML document forgery detection',
  ];

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitApplication({ ...form, passport_file: passportFile, visa_file: visaFile });
      setTab('verify');
    } catch {}
    finally { setSubmitting(false); }
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyResults([]);
    setCurrentStep(0);
    setVerifyDone(false);

    // Animate steps
    const results: VerificationResult[] = [];
    for (let i = 0; i < CHECKS.length; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 900));
    }

    try {
      const { data } = await runVerification(user!.user_id);
      setVerifyResults(data.results || []);
      setVerifyPassed(data.passed);
      setVerifyDone(true);
      setCurrentStep(-1);
      if (data.passed) getMyStatus().then(r => setMyStatus(r.data)).catch(() => {});
    } catch {
      setVerifyDone(true);
      setVerifyPassed(false);
    }
    setVerifying(false);
  }

  const sidebarItems: { id: Tab; icon: string; label: string }[] = [
    { id: 'apply', icon: '📋', label: 'Apply' },
    { id: 'verify', icon: '🤖', label: 'AI Verification' },
    { id: 'eid', icon: '🆔', label: 'E-Border ID' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>
      {/* Sidebar */}
      <div style={{ width: 200, background: '#fff', borderRight: '1px solid #eee', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
          <div style={{ background: '#3b82f6', color: '#fff', display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, marginBottom: 6 }}>TRAVELLER</div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{user?.name}</div>
          <div style={{ color: '#888', fontSize: 11 }}>{user?.user_id}</div>
        </div>
        {sidebarItems.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px',
            background: tab === item.id ? '#fff7f0' : 'transparent',
            borderLeft: tab === item.id ? '3px solid #FF6B00' : '3px solid transparent',
            color: tab === item.id ? '#FF6B00' : '#555',
            fontWeight: tab === item.id ? 500 : 400, fontSize: 13,
            border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer'
          }}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
        {myStatus && (
          <div style={{ margin: 16, padding: 12, background: myStatus.flag === 'green' ? '#f0fdf4' : '#fef2f2', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Current Status</div>
            <div style={{ fontWeight: 600, color: myStatus.flag === 'green' ? '#15803d' : '#b91c1c', fontSize: 13 }}>
              {myStatus.flag === 'green' ? '✅ Cleared' : '❌ Flagged'}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28, background: '#f8f7f4' }}>
        {tab === 'apply' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Border Entry Application</h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>Submit your documents for verification.</p>
            <form onSubmit={handleApply} className="card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Passport Number</label>
                  <input value={user?.user_id || ''} readOnly style={{ background: '#f4f2ee' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Nationality</label>
                  <input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="e.g. United States" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Purpose of Visit</label>
                  <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}>
                    {['Tourism', 'Business', 'Medical', 'Study', 'Research', 'Humanitarian', 'Transit'].map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Duration of Stay</label>
                  <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 15 days" required />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>Upload Passport Copy</label>
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px', border: `1.5px dashed ${passportFile ? '#22c55e' : '#ccc'}`,
                  borderRadius: 10, cursor: 'pointer', fontSize: 13,
                  color: passportFile ? '#15803d' : '#888', background: passportFile ? '#f0fdf4' : '#fff'
                }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                    onChange={e => setPassportFile(e.target.files?.[0]?.name || null)} />
                  {passportFile ? `✅ ${passportFile}` : '📎 Click to upload passport scan (PDF/JPG)'}
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>Upload Visa Copy</label>
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px', border: `1.5px dashed ${visaFile ? '#22c55e' : '#ccc'}`,
                  borderRadius: 10, cursor: 'pointer', fontSize: 13,
                  color: visaFile ? '#15803d' : '#888', background: visaFile ? '#f0fdf4' : '#fff'
                }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                    onChange={e => setVisaFile(e.target.files?.[0]?.name || null)} />
                  {visaFile ? `✅ ${visaFile}` : '📎 Click to upload visa document (PDF/JPG)'}
                </label>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Additional Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Hotel address, India contact, purpose details..." style={{ height: 80, resize: 'vertical' }} />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', padding: 12 }}>
                {submitting ? 'Submitting...' : 'Submit for AI Verification →'}
              </button>
            </form>
          </div>
        )}

        {tab === 'verify' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>AI Document Verification</h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
              7-point automated verification against government databases.
            </p>
            <div className="card">
              {CHECKS.map((check, i) => {
                let cls = 'pending';
                let icon = '⏳';
                if (verifyDone && verifyResults[i]) {
                  cls = verifyResults[i].passed ? 'pass' : 'fail';
                  icon = verifyResults[i].passed ? '✅' : '❌';
                } else if (verifying && i === currentStep) {
                  cls = 'running'; icon = '🔄';
                } else if (verifying && i < currentStep) {
                  cls = 'pass'; icon = '✅';
                }
                return (
                  <div key={i} className={`verify-step ${cls}`}>
                    <span style={{ fontSize: 16, minWidth: 22 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{check}</div>
                      {verifyDone && verifyResults[i] && (
                        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>{verifyResults[i].detail}</div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button onClick={handleVerify} disabled={verifying} className="btn-primary"
                style={{ width: '100%', marginTop: 20, padding: 12 }}>
                {verifying ? '🤖 Running AI checks...' : 'Run AI Verification'}
              </button>

              {verifyDone && (
                <div style={{
                  marginTop: 16, padding: 16, borderRadius: 10,
                  background: verifyPassed ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${verifyPassed ? '#86efac' : '#fca5a5'}`
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: verifyPassed ? '#15803d' : '#b91c1c' }}>
                    {verifyPassed ? '✅ All checks passed — E-Border ID ready!' : '❌ Verification failed — entry not permitted'}
                  </div>
                  {verifyPassed && (
                    <button onClick={() => setTab('eid')} className="btn-primary" style={{ marginTop: 12, padding: '9px 20px' }}>
                      Generate E-Border ID →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'eid' && (
          <div style={{ maxWidth: 500 }}>
            <h2 style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Your E-Border ID</h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>Show this QR code at the checkpoint.</p>

            {myStatus?.border_id ? (
              <div>
                {/* ID Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #0a1628 0%, #112240 100%)',
                  color: '#fff', borderRadius: 16, padding: 24, marginBottom: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                        Government of India — E-Border Entry Pass
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{myStatus.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{myStatus.border_id.border_id}</div>
                    </div>
                    <div style={{ background: '#E8A020', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🦁</div>
                  </div>

                  {/* QR Code */}
                  <div style={{ textAlign: 'center', margin: '16px 0' }}>
                    <img
                      src={`data:image/png;base64,${myStatus.border_id.qr_code_base64}`}
                      alt="QR Code"
                      style={{ width: 160, height: 160, borderRadius: 8, background: '#fff', padding: 8 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {[
                      { label: 'Checkpoint', value: myStatus.checkpoint },
                      { label: 'Valid Until', value: new Date(myStatus.border_id.valid_until).toLocaleDateString() },
                      { label: 'Status', value: '✓ CLEARED', green: true },
                    ].map(d => (
                      <div key={d.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 2 }}>{d.label}</div>
                        <div style={{ fontSize: 12, color: d.green ? '#86efac' : '#fff', fontWeight: d.green ? 600 : 400 }}>{d.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14, fontSize: 13, color: '#15803d' }}>
                  <strong>Instructions:</strong> Show this QR code to the Border Security Officer at the checkpoint. Keep it readily accessible on your device. Valid for 24 hours from issue.
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>E-Border ID Not Yet Generated</div>
                <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
                  Complete AI verification first to generate your E-Border ID.
                </div>
                <button onClick={() => setTab('verify')} className="btn-primary" style={{ padding: '10px 24px' }}>
                  Go to Verification →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
