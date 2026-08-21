import React, { useEffect, useState } from 'react';
import {
  Camera, History, BarChart3, Settings, ShieldCheck, ClipboardCheck,
  Bell, AlertTriangle, CheckCircle2, QrCode, X, Eye, Loader2,
  RefreshCw, AlertCircle, ThumbsUp, ShieldAlert
} from 'lucide-react';
import CameraViewfinder from './CameraViewfinder';
import { fetchTrends, fetchClientReports, resolveClientReport, predictBathroom } from '../services/api';
import { getCachedUser } from '../services/api';
import './Dashboard.css';

// ─── Processing stages animation (reused inside modal) ────────────────────────
const STAGES = [
  "Loading AI Model...",
  "Detecting Bathroom...",
  "Analyzing Cleanliness...",
  "Calculating Hygiene Score...",
  "Generating Verification Report...",
];

function InlineProcessing({ imageSrc }) {
  const [stageIdx, setStageIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStageIdx(p => (p < STAGES.length - 1 ? p + 1 : p)), 480);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rv-processing-body">
      <div className="rv-scan-frame">
        {imageSrc && <img src={imageSrc} alt="Scanning" className="rv-scan-img" />}
        <div className="rv-scan-overlay">
          <div className="rv-laser-beam" />
          <div className="rv-viewfinder-corners">
            <div className="rv-corner tl" /><div className="rv-corner tr" />
            <div className="rv-corner bl" /><div className="rv-corner br" />
          </div>
          <div className="rv-holo-tag">
            <Eye size={12} />
            <span>LIVE CV RUN</span>
          </div>
        </div>
      </div>
      <div className="rv-stages">
        <div className="rv-spinner-row">
          <Loader2 size={20} className="rv-spinner" />
          <span className="rv-stage-title">Computer Vision Analysis</span>
        </div>
        {STAGES.map((s, i) => (
          <div key={i} className={`rv-stage-row ${i < stageIdx ? 'rv-done' : ''} ${i === stageIdx ? 'rv-active' : ''}`}>
            <div className="rv-stage-dot">
              {i < stageIdx && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Score badge colour helper ─────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 90) return 'var(--color-success)';
  if (score >= 70) return '#f59e0b';
  return 'var(--color-danger)';
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ user, navigateTo, onOpenClientPortal }) {
  const [stats, setStats] = useState({ todayCount: 0, avgScore: 0 });
  const [clientAlerts, setClientAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Resolve-scan modal state ──────────────────────────────────────────────
  // resolveStep: null | 'camera' | 'processing' | 'result'
  const [resolveStep, setResolveStep] = useState(null);
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolveError, setResolveError] = useState('');
  const [supervisorAlert, setSupervisorAlert] = useState(null);

  const [capturedPreview, setCapturedPreview] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [cvResult, setCvResult] = useState(null);

  const loadData = async () => {
    try {
      const [trends, alerts] = await Promise.all([fetchTrends(), fetchClientReports()]);
      setStats(trends);
      setClientAlerts(alerts);
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Supervisor Random Spot Check Logic
  useEffect(() => {
    if (user && user.role === 'supervisor') {
      const interval = setInterval(() => {
        // High chance to trigger just so the user sees it in the demo
        if (Math.random() > 0.3) {
          const blocks = ['A', 'B', 'C', 'D'];
          const floors = [1, 2, 3, 4];
          
          // Use a deterministic room assignment based on hour and user ID
          // to guarantee multiple supervisors don't get the same room
          const hour = Math.floor(Date.now() / 3600000);
          const userIdNum = typeof user.id === 'number' ? user.id : String(user.id).charCodeAt(0);
          
          // 4 blocks * 4 floors * 9 rooms = 144 possible combinations
          // Add a prime multiplier for the user ID to ensure spacing between supervisors
          const roomIndex = (hour + userIdNum * 37) % 144;
          
          const bIndex = Math.floor(roomIndex / 36);
          const fIndex = Math.floor((roomIndex % 36) / 9);
          const rIndex = roomIndex % 9;

          const b = blocks[bIndex];
          const f = floors[fIndex];
          const r = `${f}0${rIndex + 1}`;
          
          setSupervisorAlert({ block: b, floor: f, room: r });
        }
      }, 3600000); // Check every 1 hour

      return () => clearInterval(interval);
    }
  }, [user]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const pendingAlerts = clientAlerts.filter(a => a.status === 'PENDING');

  // ── Step 1: Worker clicks "Mark Resolved" ─────────────────────────────────
  const handleOpenResolveFlow = (alert) => {
    setResolvingAlert(alert);
    setCapturedPreview(null);
    setCapturedFile(null);
    setCvResult(null);
    setResolveError('');
    setResolveStep('camera');
  };

  // ── Step 1 → 2: Photo captured, start CV run ──────────────────────────────
  const handleCameraCapture = async (previewUrl, fileObj) => {
    setCapturedPreview(previewUrl);
    setCapturedFile(fileObj);
    setResolveStep('processing');

    try {
      const cachedUser = getCachedUser();
      const formData = {
        hospitalName: resolvingAlert.hospital_name || 'City General Hospital',
        block: resolvingAlert.block,
        floorNumber: resolvingAlert.floor_number,
        roomNumber: resolvingAlert.room_number,
        bathroomId: resolvingAlert.bathroom_id,
        inspectorName: user?.name || cachedUser?.name || 'Worker',
        resolvedAlertId: resolvingAlert.report_id,
      };
      const result = await predictBathroom(formData, fileObj);
      setCvResult(result);
      setResolveStep('result');
    } catch (err) {
      console.error("CV scan failed", err);
      setResolveError('CV analysis failed. Please retake the photo and try again.');
      setResolveStep('camera');
    }
  };

  // ── Step 3: Worker confirms → resolve with scan evidence ──────────────────
  const handleConfirmResolve = async () => {
    if (!resolvingAlert || !cvResult) return;
    try {
      const scanResult = {
        score: cvResult.score,
        status: cvResult.status,
        confidence: cvResult.confidence,
        imageUrl: cvResult.imageUrl,
        issues: cvResult.issues,
        inspectionId: cvResult.id,
        resolvedAt: new Date().toISOString(),
      };
      await resolveClientReport(resolvingAlert.report_id, scanResult);
      setResolveStep(null);
      setResolvingAlert(null);
      loadData();
    } catch (err) {
      console.error("Failed to resolve alert", err);
    }
  };

  const handleCloseModal = () => {
    setResolveStep(null);
    setResolvingAlert(null);
    setCapturedPreview(null);
    setCapturedFile(null);
    setCvResult(null);
    setResolveError('');
  };

  return (
    <div className="dashboard-container animate-fade">

      {/* ── Supervisor Random Check Notification ── */}
      {supervisorAlert && (
        <div className="supervisor-toast animate-slide-down">
          <div className="toast-icon pulse-alert">
            <Bell size={20} className="text-primary" />
          </div>
          <div className="toast-content">
            <h4 className="toast-title">Random Spot Check</h4>
            <p className="toast-desc">
              Please proceed to <strong>Block {supervisorAlert.block}, Floor {supervisorAlert.floor}, Room {supervisorAlert.room}</strong> for a random quality check.
            </p>
          </div>
          <button className="toast-close-btn" onClick={() => setSupervisorAlert(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── CV Verification Modal ─────────────────────────────────────────── */}
      {resolveStep && resolvingAlert && (
        <div className="rv-modal-overlay animate-fade">
          <div className="rv-modal-card glass-card">

            {/* Modal Header */}
            <div className="rv-modal-header">
              <div className="rv-modal-title-group">
                <ShieldCheck size={18} className="text-primary" />
                <div>
                  <h3 className="rv-modal-title">Post-Cleaning Verification</h3>
                  <p className="rv-modal-subtitle">
                    Block {resolvingAlert.block} · Floor {resolvingAlert.floor_number} · Room {resolvingAlert.room_number}
                  </p>
                </div>
              </div>
              {resolveStep !== 'processing' && (
                <button className="rv-close-btn" onClick={handleCloseModal} title="Cancel">
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Step indicator */}
            <div className="rv-step-track">
              {['camera', 'processing', 'result'].map((step, idx) => (
                <React.Fragment key={step}>
                  <div className={`rv-step-dot ${resolveStep === step ? 'rv-step-active' : ''} ${
                    ['camera', 'processing', 'result'].indexOf(resolveStep) > idx ? 'rv-step-done' : ''
                  }`}>
                    {idx + 1}
                  </div>
                  {idx < 2 && <div className="rv-step-line" />}
                </React.Fragment>
              ))}
            </div>
            <div className="rv-step-labels">
              <span>Take Photo</span>
              <span>CV Analysis</span>
              <span>Confirm</span>
            </div>

            {/* ── Step 1: Camera ─────────────────────────────────────────── */}
            {resolveStep === 'camera' && (
              <div className="rv-camera-step">
                {resolveError && (
                  <div className="rv-error-banner">
                    <AlertCircle size={14} />
                    <span>{resolveError}</span>
                  </div>
                )}
                <div className="rv-camera-instruction">
                  <Camera size={28} className="rv-camera-icon-big" />
                  <p className="rv-instruction-text">
                    Take a live photo of the <strong>cleaned bathroom</strong> to run through the CV model.
                    Admins will see this as photo proof that the area has been cleaned.
                  </p>
                </div>
                <div className="rv-open-camera-wrapper">
                  <CameraViewfinder
                    title="Capture Cleaned Bathroom"
                    onCapture={handleCameraCapture}
                    onClose={handleCloseModal}
                  />
                </div>
              </div>
            )}

            {/* ── Step 2: Processing ────────────────────────────────────── */}
            {resolveStep === 'processing' && (
              <InlineProcessing imageSrc={capturedPreview} />
            )}

            {/* ── Step 3: CV Result ─────────────────────────────────────── */}
            {resolveStep === 'result' && cvResult && (
              <div className="rv-result-step">
                {/* Score banner */}
                <div
                  className="rv-score-banner"
                  style={{ borderColor: scoreColor(cvResult.score) }}
                >
                  <div className="rv-score-ring" style={{ color: scoreColor(cvResult.score) }}>
                    <span className="rv-score-number">{cvResult.score}</span>
                    <span className="rv-score-unit">%</span>
                  </div>
                  <div className="rv-score-info">
                    <span className="rv-score-label">Hygiene Score</span>
                    <span className="rv-score-status" style={{ color: scoreColor(cvResult.score) }}>
                      {cvResult.status}
                    </span>
                    <span className="rv-score-confidence">
                      Confidence: {cvResult.confidence?.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Photo evidence */}
                {cvResult.imageUrl && (
                  <div className="rv-evidence-wrapper">
                    <p className="rv-evidence-label">📷 Photographic Evidence</p>
                    <img src={cvResult.imageUrl} alt="Cleaned bathroom evidence" className="rv-evidence-img" />
                  </div>
                )}

                {/* Issues found */}
                {cvResult.issues?.length > 0 && (
                  <div className="rv-issues-box">
                    <p className="rv-issues-label">
                      <AlertTriangle size={13} /> Remaining Issues Detected
                    </p>
                    <ul className="rv-issues-list">
                      {cvResult.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                  </div>
                )}

                {cvResult.issues?.length === 0 && (
                  <div className="rv-all-clear">
                    <ThumbsUp size={16} />
                    <span>No issues detected — bathroom verified clean!</span>
                  </div>
                )}

                <p className="rv-confirm-note">
                  This CV scan result will be saved as proof of resolution. Admins will be able to review the photo and score.
                </p>

                <div className="rv-action-row">
                  <button className="btn btn-secondary rv-retake-btn" onClick={() => {
                    setCvResult(null);
                    setCapturedPreview(null);
                    setCapturedFile(null);
                    setResolveStep('camera');
                  }}>
                    <RefreshCw size={14} /> Retake Photo
                  </button>
                  <button className="btn btn-primary rv-confirm-btn" onClick={handleConfirmResolve}>
                    <CheckCircle2 size={14} /> Confirm Resolved
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dashboard-header">
        <div className="header-brand">
          <ShieldCheck size={20} className="text-primary" />
          <span className="brand-title">CleanVision Staff</span>
        </div>
        <div className="header-actions-right">
          {pendingAlerts.length > 0 && (
            <div className="alerts-badge-pill" title={`${pendingAlerts.length} Active Client Alerts`}>
              <Bell size={14} className="bell-pulse" />
              <span>{pendingAlerts.length} Alerts</span>
            </div>
          )}
          <div className="inspector-pill">
            <div className="inspector-avatar">
              {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'UI'}
            </div>
            <span className="inspector-name-text">{user.name || 'Worker'}</span>
          </div>
        </div>
      </div>

      {/* Greeting Banner */}
      <div className="welcome-banner">
        <div className="welcome-text-group">
          <h2 className="welcome-title">{getGreeting()},</h2>
          <h3 className="welcome-user">{user.name || 'Worker'}</h3>
          <p className="welcome-subtitle">Role: {user.role?.toUpperCase()} · Access: Block {user.block_access || 'ALL'}</p>
        </div>
        <button className="visitor-qr-quick-btn" onClick={onOpenClientPortal} title="Open Visitor QR Complaint Screen">
          <QrCode size={18} />
          <span>Visitor QR</span>
        </button>
      </div>

      {/* Patient/Visitor Alerts */}
      {pendingAlerts.length > 0 && (
        <div className="client-alerts-section animate-slide-up">
          <div className="alerts-section-hdr">
            <AlertTriangle size={16} className="text-danger" />
            <h4 className="alerts-section-title">Active Patient/Visitor Alerts ({pendingAlerts.length})</h4>
          </div>
          <div className="alerts-cards-list">
            {pendingAlerts.map(alert => (
              <div key={alert.report_id} className="alert-card glass-card">
                <div className="alert-card-header">
                  <span className="alert-location-tag">
                    Block {alert.block} · Floor {alert.floor_number} · Room {alert.room_number}
                  </span>
                  <span className="alert-time-tag">
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="alert-card-body">
                  <span className="alert-issue-name">{alert.issue_type}</span>
                  {alert.notes && <p className="alert-notes">"{alert.notes}"</p>}
                </div>
                <div className="alert-card-actions">
                  <button
                    className="btn btn-sm btn-primary resolve-scan-btn"
                    onClick={() => handleOpenResolveFlow(alert)}
                  >
                    <Camera size={13} />
                    Mark Resolved &amp; Initiate Clean Scan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Metrics */}
      <div className="metrics-summary glass-card">
        <div className="metric-item">
          <span className="metric-label">Today's Audits</span>
          <span className="metric-value">{loading ? '...' : stats.todayCount}</span>
          <span className="metric-subtext">completed</span>
        </div>
        <div className="metric-divider" />
        <div className="metric-item">
          <span className="metric-label">Average Score</span>
          <span className={`metric-value ${stats.avgScore >= 70 ? 'text-success' : 'text-warning'}`}>
            {loading ? '...' : `${stats.avgScore}%`}
          </span>
          <span className="metric-subtext">quality index</span>
        </div>
      </div>

      {/* Quick Nav Grid */}
      <h4 className="section-label">Staff Workspace</h4>
      <div className="menu-grid">
        <button className="menu-card glass-card" onClick={() => navigateTo('scan')}>
          <div className="card-icon-wrapper scan-icon"><Camera size={26} /></div>
          <div className="card-info">
            <span className="card-title">Scan Bathroom</span>
            <span className="card-description">Trigger AI cleanliness audit</span>
          </div>
        </button>
        <button className="menu-card glass-card" onClick={() => navigateTo('history')}>
          <div className="card-icon-wrapper history-icon"><History size={26} /></div>
          <div className="card-info">
            <span className="card-title">Inspection Logs</span>
            <span className="card-description">View logs and details</span>
          </div>
        </button>
        <button className="menu-card glass-card" onClick={() => navigateTo('reports')}>
          <div className="card-icon-wrapper reports-icon"><BarChart3 size={26} /></div>
          <div className="card-info">
            <span className="card-title">Reports &amp; Trends</span>
            <span className="card-description">Hygiene charts for managers</span>
          </div>
        </button>
        <button className="menu-card glass-card" onClick={() => navigateTo('settings')}>
          <div className="card-icon-wrapper settings-icon"><Settings size={26} /></div>
          <div className="card-info">
            <span className="card-title">System Settings</span>
            <span className="card-description">Languages, dark mode &amp; info</span>
          </div>
        </button>
      </div>

      <div className="safety-card">
        <ClipboardCheck size={18} className="safety-icon" />
        <p className="safety-text">
          Keep our hospital safe. Complete CV-verified audits after every visitor alert — photo evidence is required.
        </p>
      </div>
    </div>
  );
}
