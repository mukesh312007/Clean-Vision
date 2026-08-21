import React, { useState, useEffect } from 'react';
import { QrCode, Camera, CheckCircle2, ArrowLeft, AlertTriangle, RefreshCw, Send, ShieldCheck, MapPin, LockKeyhole } from 'lucide-react';
import { submitClientReport } from '../services/api';
import CameraViewfinder from './CameraViewfinder';
import './ClientScanScreen.css';

const SAMPLE_QRS = [
  { label: 'Block B - Floor 2 - Room 204', block: 'B', floor: '2', room: '204', bathId: 'CGH-B-204-B1' },
  { label: 'Block A - Floor 1 - Room 101', block: 'A', floor: '1', room: '101', bathId: 'CGH-A-101-B1' },
  { label: 'Block C - Floor 3 - Room 312', block: 'C', floor: '3', room: '312', bathId: 'CGH-C-312-B2' },
  { label: 'Block D - Floor 4 - Room 405', block: 'D', floor: '4', room: '405', bathId: 'CGH-D-405-B1' },
];

const ISSUE_TYPES = [
  'Wet Floor & Water Spill',
  'Trash Bin Overflowing',
  'Soap Dispenser Empty',
  'Paper Towel Empty',
  'Dirty Toilet / Unsanitized',
  'Odour Issue / Ventilation'
];

export default function ClientScanScreen({ initialParams, onOpenWorkerLogin }) {
  const [location, setLocation] = useState({
    hospitalName: 'City General Hospital',
    block: initialParams?.block || 'B',
    floorNumber: initialParams?.floor || '2',
    roomNumber: initialParams?.room || '204',
    bathroomId: initialParams?.bathId || 'CGH-B-204-B1',
  });

  const [selectedIssue, setSelectedIssue] = useState('Wet Floor & Water Spill');
  const [notes, setNotes] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  // Sync Bathroom ID
  useEffect(() => {
    setLocation(prev => ({
      ...prev,
      bathroomId: `CGH-${prev.block.toUpperCase()}-${prev.floorNumber}${prev.roomNumber}-B1`
    }));
  }, [location.block, location.floorNumber, location.roomNumber]);

  const handleCameraCapture = (previewUrl, fileObj) => {
    setSelectedImage(previewUrl);
    setImageFile(fileObj);
    setShowCamera(false);
    setError('');
  };

  const handleSimulateQr = (qr) => {
    setLocation({
      hospitalName: 'City General Hospital',
      block: qr.block,
      floorNumber: qr.floor,
      roomNumber: qr.room,
      bathroomId: qr.bathId
    });
    setShowQrModal(false);
  };

  const handleSubmitReport = async () => {
    setError('');
    setSubmitting(true);

    try {
      await submitClientReport({
        ...location,
        issueType: selectedIssue,
        notes
      }, imageFile);

      setSubmitted(true);
    } catch (e) {
      setError('Failed to send alert to staff. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="client-screen animate-fade">
        <div className="client-success-card glass-card">
          <div className="success-icon-box">
            <CheckCircle2 size={48} className="text-success" />
          </div>
          <h2 className="success-title">Housekeeping Staff Notified!</h2>
          <p className="success-desc">
            Your complaint photo and location (<strong>Block {location.block}, Floor {location.floorNumber}, Room {location.roomNumber}</strong>) have been dispatched directly to on-duty cleaning workers.
          </p>

          <div className="success-location-pill">
            <MapPin size={14} />
            <span>{location.hospitalName} · {location.bathroomId}</span>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => { setSubmitted(false); setSelectedImage(null); setImageFile(null); setNotes(''); }}
            style={{ marginTop: '20px' }}
          >
            Report Another Location
          </button>

          <button
            className="btn btn-outline"
            onClick={onOpenWorkerLogin}
            style={{ marginTop: '10px' }}
          >
            Staff Login Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-screen animate-fade">
      {/* Header */}
      <div className="client-header">
        <div className="header-title-box">
          <span className="client-badge">PATIENT & VISITOR HYGIENE PORTAL</span>
          <h2 className="screen-title">Report Bathroom Issue</h2>
        </div>
        <div className="header-actions">
          <button className="qr-sim-btn" onClick={() => setShowQrModal(true)} title="Simulate QR scan">
            <QrCode size={16} />
          </button>
          <button className="staff-login-pill-btn" onClick={onOpenWorkerLogin}>
            Staff Login
          </button>
        </div>
      </div>

      <div className="client-scroll-body">
        {/* Location Banner (Autofilled by QR) */}
        <div className="qr-autofill-banner glass-card">
          <div className="qr-banner-icon">
            <QrCode size={22} className="text-primary" />
          </div>
          <div className="qr-banner-texts">
            <div className="qr-autofill-tag">✓ Autofilled from Bathroom QR Code</div>
            <h3 className="location-heading">Block {location.block} · Floor {location.floorNumber} · Room {location.roomNumber}</h3>
            <span className="location-sub">{location.hospitalName} ({location.bathroomId})</span>
          </div>
          <button className="change-qr-btn" onClick={() => setShowQrModal(true)}>
            Change QR
          </button>
        </div>

        {error && (
          <div className="error-alert animate-slide-up">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Issue Type Chips */}
        <div className="section-card glass-card">
          <h3 className="section-card-title">Select What Needs Attention</h3>
          <div className="issue-chips-grid">
            {ISSUE_TYPES.map(issue => (
              <button
                key={issue}
                type="button"
                className={`issue-chip ${selectedIssue === issue ? 'chip-selected' : ''}`}
                onClick={() => setSelectedIssue(issue)}
              >
                {issue}
              </button>
            ))}
          </div>
        </div>

        {/* Live Camera Capture Only */}
        <div className="section-card glass-card">
          <h3 className="section-card-title">Take Photo for Housekeeping</h3>

          {!selectedImage ? (
            <button className="upload-box upload-box-full live-camera-trigger-box" onClick={() => setShowCamera(true)}>
              <div className="upload-box-icon camera-pulse">
                <Camera size={34} />
              </div>
              <span className="upload-box-title">Tap to Open Live Camera</span>
              <span className="upload-box-desc">Requires live photo capture of issue</span>
              <div className="live-camera-badge">
                <LockKeyhole size={13} />
                <span>Live Viewfinder (No Uploads)</span>
              </div>
            </button>
          ) : (
            <div className="image-preview-container">
              <img src={selectedImage} alt="Captured issue" className="image-preview" />
              <button className="change-image-btn" onClick={() => setShowCamera(true)}>
                <RefreshCw size={14} /> Retake Photo
              </button>
            </div>
          )}
        </div>

        {/* Optional Notes */}
        <div className="section-card glass-card">
          <h3 className="section-card-title">Additional Comments (Optional)</h3>
          <textarea
            className="form-control notes-textarea"
            placeholder="e.g., Water is leaking near the sink, watch out for slip risk..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          ></textarea>
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary submit-alert-btn"
          disabled={submitting}
          onClick={handleSubmitReport}
        >
          {submitting ? 'Dispatching Alert...' : <><Send size={18} /> Send Alert to On-Duty Worker</>}
        </button>

        <div className="client-footer-note">
          <ShieldCheck size={14} />
          <span>Alerts are dispatched immediately to staff assigned to Block {location.block}.</span>
        </div>
      </div>

      {/* QR Simulation Modal */}
      {showQrModal && (
        <div className="modal-overlay animate-fade">
          <div className="modal-card glass-card animate-slide-up">
            <h3 className="modal-title">Simulate Door QR Scan</h3>
            <p className="modal-desc">In real deployment, patients & visitors scan the QR sticker posted on the bathroom door. Choose a location to test autofill:</p>

            <div className="qr-options-list">
              {SAMPLE_QRS.map((qr, idx) => (
                <button key={idx} className="qr-option-item" onClick={() => handleSimulateQr(qr)}>
                  <QrCode size={18} className="text-primary" />
                  <div className="qr-opt-texts">
                    <span className="qr-opt-lbl">{qr.label}</span>
                    <span className="qr-opt-sub">{qr.bathId}</span>
                  </div>
                </button>
              ))}
            </div>

            <button className="btn btn-outline" onClick={() => setShowQrModal(false)} style={{ marginTop: '14px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Camera Viewfinder Modal */}
      {showCamera && (
        <CameraViewfinder
          title="Take Complaint Photo"
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
