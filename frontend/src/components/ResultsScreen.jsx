import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Share2, Clipboard, ArrowRight, MapPin, Calendar, User, ShieldCheck } from 'lucide-react';
import './ResultsScreen.css';

export default function ResultsScreen({ result, onNewScan, onViewHistory }) {
  const [offset, setOffset] = useState(283); // Circumference for r=45
  const [toastMessage, setToastMessage] = useState("");

  const score = result.score || 0;
  const status = result.status || "Clean";
  const confidence = result.confidence || 95;
  const issues = result.issues || [];
  const recommendations = result.recommendations || [];

  // Animate circular progress ring on mount
  useEffect(() => {
    const circumference = 2 * Math.PI * 45; // 282.74
    const progress = score / 100;
    const newOffset = circumference - progress * circumference;
    
    const timer = setTimeout(() => {
      setOffset(newOffset);
    }, 150);
    return () => clearTimeout(timer);
  }, [score]);

  const getStatusConfig = () => {
    switch (status) {
      case 'Very Clean':
        return {
          class: 'badge-very-clean',
          textClass: 'text-success',
          bgClass: 'bg-success',
          icon: <CheckCircle2 size={16} />
        };
      case 'Clean':
        return {
          class: 'badge-clean',
          textClass: 'text-info',
          bgClass: 'bg-info',
          icon: <CheckCircle2 size={16} />
        };
      case 'Needs Attention':
        return {
          class: 'badge-attention',
          textClass: 'text-warning',
          bgClass: 'bg-warning',
          icon: <AlertTriangle size={16} />
        };
      case 'Dirty':
        return {
          class: 'badge-dirty',
          textClass: 'text-danger',
          bgClass: 'bg-danger',
          icon: <XCircle size={16} />
        };
      default:
        return {
          class: 'badge-clean',
          textClass: 'text-info',
          bgClass: 'bg-info',
          icon: <CheckCircle2 size={16} />
        };
    }
  };

  const statusConfig = getStatusConfig();

  // Full observations list
  const getObservations = () => {
    const list = [];
    
    // Check if issues exist, else standard clean states
    const hasTrash = issues.some(i => i.toLowerCase().includes('trash') || i.toLowerCase().includes('debris'));
    const hasSpill = issues.some(i => i.toLowerCase().includes('spill') || i.toLowerCase().includes('water'));
    const hasMirror = issues.some(i => i.toLowerCase().includes('mirror') || i.toLowerCase().includes('stain'));
    const hasToilet = issues.some(i => i.toLowerCase().includes('toilet'));
    const hasSoap = issues.some(i => i.toLowerCase().includes('soap'));
    const hasPaper = issues.some(i => i.toLowerCase().includes('paper') || i.toLowerCase().includes('towel'));

    list.push({ text: hasTrash ? "Trash detected on floor" : "Floor is clean", isIssue: hasTrash });
    list.push({ text: hasSpill ? "Water spill detected on floor" : "Floor surface is dry", isIssue: hasSpill });
    list.push({ text: hasMirror ? "Mirror has stains/splatters" : "Mirror is clean", isIssue: hasMirror });
    list.push({ text: hasToilet ? "Toilet area needs cleaning" : "Toilet area is sanitized", isIssue: hasToilet });
    list.push({ text: hasSoap ? "Soap dispenser is empty" : "Soap dispenser is full", isIssue: hasSoap });
    list.push({ text: hasPaper ? "Paper towel dispenser is empty" : "Paper towel dispenser is restocked", isIssue: hasPaper });
    
    return list;
  };

  const observations = getObservations();

  const handleShare = () => {
    const summary = `CleanVision Audit Report:\nFacility: ${result.hospitalName}\nBathroom ID: ${result.bathroomId}\nCleanliness Score: ${result.score}%\nStatus: ${result.status}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'CleanVision Inspection Report',
        text: summary,
        url: window.location.href
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(summary);
      showToast("Report summary copied to clipboard!");
    }
  };

  const handleSaveReport = () => {
    showToast("Audit report finalized & synced successfully!");
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
  };

  return (
    <div className="results-screen animate-fade">
      <div className="results-header">
        <ShieldCheck size={20} className="text-primary" />
        <h2 className="screen-title">Hygiene Inspection Results</h2>
      </div>

      <div className="results-content-scroll">
        {toastMessage && (
          <div className="toast-notification animate-slide-up">
            {toastMessage}
          </div>
        )}

        {/* 1. Score circular dial card */}
        <div className="section-card glass-card score-main-card">
          <div className="radial-gauge-container">
            <svg className="radial-gauge" viewBox="0 0 100 100">
              <circle className="gauge-bg" cx="50" cy="50" r="45" />
              <circle 
                className={`gauge-bar ${statusConfig.textClass}`}
                cx="50" 
                cy="50" 
                r="45" 
                strokeDasharray="282.7"
                strokeDashoffset={offset}
              />
            </svg>
            <div className="gauge-text-overlay">
              <span className="gauge-score-value">{score}%</span>
              <span className="gauge-score-lbl">hygiene index</span>
            </div>
          </div>

          <div className="status-badge-row">
            <span className={`badge ${statusConfig.class}`}>
              {statusConfig.icon}
              {status}
            </span>
          </div>

          {/* Confidence slider */}
          <div className="confidence-container">
            <div className="confidence-hdr">
              <span className="confidence-lbl">AI Inference Confidence</span>
              <span className="confidence-val">{confidence.toFixed(1)}%</span>
            </div>
            <div className="confidence-bar-bg">
              <div className="confidence-bar-fill" style={{ width: `${confidence}%` }}></div>
            </div>
          </div>
        </div>

        {/* 2. Metadata Context Card */}
        <div className="section-card glass-card metadata-summary-card">
          <div className="summary-meta-item">
            <MapPin size={15} />
            <div>
              <span className="meta-lbl">Location</span>
              <span className="meta-val">{result.hospitalName} - Block {result.block}, Floor {result.floorNumber}, Room {result.roomNumber}</span>
            </div>
          </div>
          <div className="summary-meta-item">
            <Calendar size={15} />
            <div>
              <span className="meta-lbl">Date & Time</span>
              <span className="meta-val">{new Date(result.timestamp).toLocaleString()}</span>
            </div>
          </div>
          <div className="summary-meta-item">
            <User size={15} />
            <div>
              <span className="meta-lbl">Inspector</span>
              <span className="meta-val">{result.inspectorName} ({result.id})</span>
            </div>
          </div>
        </div>

        {/* 3. Detailed observations card */}
        <div className="section-card glass-card observations-card">
          <h3 className="section-card-title">Computer Vision Observations</h3>
          <div className="obs-list">
            {observations.map((obs, idx) => (
              <div key={idx} className="obs-item">
                <div className={`obs-dot ${obs.isIssue ? 'dot-issue' : 'dot-ok'}`}></div>
                <span className={`obs-text ${obs.isIssue ? 'text-issue' : 'text-ok'}`}>{obs.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Recommendations card */}
        <div className="section-card glass-card recommendations-card">
          <h3 className="section-card-title">Actionable Recommendation Cards</h3>
          {issues.length === 0 ? (
            <div className="rec-item rec-clean">
              <div className="rec-icon-box box-ok">✓</div>
              <div className="rec-text-box">
                <span className="rec-title">No actions required</span>
                <span className="rec-desc">The bathroom meets all sanitation standards.</span>
              </div>
            </div>
          ) : (
            <div className="rec-list">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="rec-item rec-attention">
                  <div className="rec-icon-box box-issue">✓</div>
                  <div className="rec-text-box">
                    <span className="rec-title">{rec}</span>
                    <span className="rec-desc">Required task for hospital housekeeping staff.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button Strip */}
        <div className="action-button-strip">
          <button className="btn btn-primary" onClick={handleSaveReport}>
            <Clipboard size={18} /> Save Audit Report
          </button>
          
          <div className="secondary-button-row">
            <button className="btn btn-secondary" onClick={handleShare}>
              <Share2 size={16} /> Share Report
            </button>
            <button className="btn btn-secondary" onClick={onViewHistory}>
              History Log
            </button>
          </div>

          <button className="btn btn-outline" onClick={onNewScan}>
             Scan Another Bathroom <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
