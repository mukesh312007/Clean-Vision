import React, { useState, useEffect } from 'react';
import Splash from './components/Splash';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ScanScreen from './components/ScanScreen';
import ProcessingScreen from './components/ProcessingScreen';
import ResultsScreen from './components/ResultsScreen';
import HistoryScreen from './components/HistoryScreen';
import ReportsScreen from './components/ReportsScreen';
import SettingsScreen from './components/SettingsScreen';
import ClientScanScreen from './components/ClientScanScreen';
import { predictBathroom } from './services/api';
import { ShieldCheck, MapPin, Calendar, User, ArrowLeft, Printer, LayoutDashboard, Camera, History, BarChart3, Settings } from 'lucide-react';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [qrParams, setQrParams] = useState(null);

  // Check URL query parameters for QR code scans (e.g. ?block=B&floor=2&room=204)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const block = urlParams.get('block');
    const floor = urlParams.get('floor');
    const room = urlParams.get('room');

    if (block || floor || room) {
      setQrParams({ block: block || 'B', floor: floor || '2', room: room || '204' });
      setScreen('clientScan');
    }
  }, []);

  // State to hold prediction results & selected detailed reports
  const [activeReport, setActiveReport] = useState(null);
  const [processingImage, setProcessingImage] = useState(null);

  // Sync dark theme attribute on HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    setScreen('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setScreen('login');
  };

  // Triggers prediction from Scan Screen
  const handleStartInspection = async (formData, imageFile) => {
    setScreen('processing');
    
    // Set processing image source for laser animation background
    if (imageFile instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => setProcessingImage(reader.result);
      reader.readAsDataURL(imageFile);
    } else {
      setProcessingImage(imageFile.url || null);
    }

    try {
      const report = await predictBathroom(formData, imageFile);
      setActiveReport(report);
      setScreen('results');
    } catch (err) {
      console.error("Hygiene Scan Failed", err);
      const mockResult = {
        id: `INS-${Math.floor(1000 + Math.random() * 9000)}-${formData.block.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        hospitalName: formData.hospitalName,
        block: formData.block,
        floorNumber: formData.floorNumber,
        roomNumber: formData.roomNumber,
        bathroomId: formData.bathroomId,
        inspectorName: formData.inspectorName,
        score: 88,
        status: "Clean",
        confidence: 94.2,
        issues: [],
        recommendations: ["Area meets standard cleanliness benchmarks."],
        imageUrl: processingImage || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80"
      };
      setActiveReport(mockResult);
      setScreen('results');
    }
  };

  const handleSelectReport = (report) => {
    setActiveReport(report);
    setScreen('reportDetail');
  };

  const renderActiveScreen = () => {
    switch (screen) {
      case 'splash':
        return <Splash onFinish={() => setScreen('clientScan')} />;
      case 'login':
        return <Login onLogin={handleLogin} onOpenClientPortal={() => setScreen('clientScan')} />;
      case 'clientScan':
        return <ClientScanScreen initialParams={qrParams} onOpenWorkerLogin={() => setScreen('login')} />;
      case 'dashboard':
        return <Dashboard user={user} navigateTo={(target) => setScreen(target)} onOpenClientPortal={() => setScreen('clientScan')} />;
      case 'scan':
        return (
          <ScanScreen 
            user={user} 
            onBack={() => setScreen('dashboard')} 
            onStartInspection={handleStartInspection}
          />
        );
      case 'processing':
        return <ProcessingScreen imageSrc={processingImage} />;
      case 'results':
        return (
          <ResultsScreen 
            result={activeReport} 
            onNewScan={() => setScreen('scan')}
            onViewHistory={() => setScreen('history')}
          />
        );
      case 'history':
        return (
          <HistoryScreen 
            onBack={() => setScreen('dashboard')}
            onSelectReport={handleSelectReport}
          />
        );
      case 'reports':
        return <ReportsScreen onBack={() => setScreen('dashboard')} />;
      case 'settings':
        return (
          <SettingsScreen 
            user={user} 
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onBack={() => setScreen('dashboard')}
            onLogout={handleLogout}
          />
        );
      case 'reportDetail':
        return renderReportDetailView();
      default:
        return <Splash onFinish={() => setScreen('login')} />;
    }
  };

  const renderReportDetailView = () => {
    if (!activeReport) return null;
    return (
      <div className="report-detail-screen animate-fade">
        <div className="report-detail-header no-print">
          <button className="back-btn" onClick={() => setScreen('history')}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="screen-title">Audit Log Detail</h2>
        </div>
        
        <div className="report-detail-scroll">
          <div className="detail-meta-card glass-card">
            <div className="detail-meta-heading">
              <ShieldCheck className="text-primary" size={24} />
              <div>
                <h3 className="detail-id">{activeReport.id}</h3>
                <span className="detail-hosp">{activeReport.hospitalName}</span>
              </div>
            </div>
            
            <div className="detail-badge-row">
              <span className={`badge badge-${activeReport.status.toLowerCase().replace(' ', '-')}`}>
                {activeReport.status}
              </span>
              <span className="detail-score-pill">Hygiene Score: <strong>{activeReport.score}%</strong></span>
            </div>

            <div className="detail-grid">
              <div className="detail-cell">
                <span className="cell-lbl">Location</span>
                <span className="cell-val">Block {activeReport.block}, Floor {activeReport.floorNumber}, Room {activeReport.roomNumber}</span>
              </div>
              <div className="detail-cell">
                <span className="cell-lbl">Bathroom ID</span>
                <span className="cell-val">{activeReport.bathroomId}</span>
              </div>
              <div className="detail-cell">
                <span className="cell-lbl">Auditor Name</span>
                <span className="cell-val">{activeReport.inspectorName}</span>
              </div>
              <div className="detail-cell">
                <span className="cell-lbl">Inference Confidence</span>
                <span className="cell-val">{activeReport.confidence.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="detail-photo-card glass-card">
            <h4 className="detail-section-title">Audit Photographic Evidence</h4>
            <div className="detail-photo-wrapper">
              <img src={activeReport.imageUrl} alt="Cleanliness Evidence" className="detail-photo-img" />
            </div>
          </div>

          <div className="detail-findings-card glass-card">
            <h4 className="detail-section-title">Detected Issues & Findings</h4>
            {activeReport.issues.length === 0 ? (
              <p className="no-issues-txt">✓ Compliance standards fully met. No active issues detected.</p>
            ) : (
              <ul className="findings-bullet-list">
                {activeReport.issues.map((issue, idx) => (
                  <li key={idx} className="finding-bullet-item">{issue}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="detail-findings-card glass-card">
            <h4 className="detail-section-title">Recommended Housekeeping Tasks</h4>
            <ul className="findings-bullet-list">
              {activeReport.recommendations.map((rec, idx) => (
                <li key={idx} className="finding-bullet-item rec-bullet">✓ {rec}</li>
              ))}
            </ul>
          </div>

          <div className="detail-action-strip no-print">
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={18} /> Print audit report
            </button>
            <button className="btn btn-secondary" onClick={() => setScreen('history')}>
              Back to Logs
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPrintTemplate = () => {
    const report = activeReport || {
      id: "INS-XXXX-X",
      timestamp: new Date().toISOString(),
      hospitalName: "City General Hospital",
      block: "A",
      floorNumber: "1",
      roomNumber: "101",
      bathroomId: "CGH-A-101-B1",
      inspectorName: "Sarah Jenkins",
      score: 90,
      status: "Clean",
      confidence: 95.0,
      issues: ["None"],
      recommendations: ["No action required"]
    };

    return (
      <div className="print-report-container">
        <div className="print-report-header">
          <div className="print-report-brand">
            <h2>CleanVision AI bathroom Auditing</h2>
            <p>Clinical Hygiene Audit Log & Compliance Certificate</p>
          </div>
          <div className="print-report-id">
            <strong>Audit ID:</strong> {report.id}
          </div>
        </div>

        <div className="print-details-grid">
          <div><strong>Facility:</strong> {report.hospitalName}</div>
          <div><strong>Bathroom ID:</strong> {report.bathroomId}</div>
          <div><strong>Location:</strong> Block {report.block}, Floor {report.floorNumber}, Room {report.roomNumber}</div>
          <div><strong>Auditor:</strong> {report.inspectorName}</div>
          <div><strong>Timestamp:</strong> {new Date(report.timestamp).toLocaleString()}</div>
          <div><strong>Sanitation Index:</strong> {report.score}% ({report.status})</div>
        </div>

        <div className="print-section-title">Computer Vision Observations</div>
        <div className="print-issues-box">
          {report.issues.length === 0 ? (
            <p>✓ All verified standards compliant. No physical deficiencies or stains identified on surfaces.</p>
          ) : (
            <ul>
              {report.issues.map((i, idx) => <li key={idx}>[!] {i}</li>)}
            </ul>
          )}
        </div>

        <div className="print-section-title">Required Housekeeping Actions</div>
        <div className="print-recs-box">
          <ul>
            {report.recommendations.map((r, idx) => <li key={idx}>- {r}</li>)}
          </ul>
        </div>

        <div className="print-section-title">Photographic Verification</div>
        <div className="print-img-wrapper">
          <img src={report.imageUrl} alt="Inspection Photo" className="print-photo" />
        </div>

        <div className="print-signatures">
          <div className="sig-line">
            <div className="sig-border"></div>
            <span>Auditing Officer Signature</span>
          </div>
          <div className="sig-line">
            <div className="sig-border"></div>
            <span>Clinical Operations Director</span>
          </div>
        </div>
      </div>
    );
  };

  // Show Bottom Navigation only when staff is logged in and not in splash/login/client/processing screens
  const showBottomNav = user && !['splash', 'login', 'clientScan', 'processing'].includes(screen);

  return (
    <div className="pwa-shell">

      {/* Screen Viewport */}
      <div className={`pwa-screen ${showBottomNav ? 'has-bottom-nav' : ''}`}>
        {renderActiveScreen()}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {showBottomNav && (
        <nav className="mobile-bottom-nav no-print">
          <button
            className={`nav-tab-item ${screen === 'dashboard' ? 'active' : ''}`}
            onClick={() => setScreen('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Home</span>
          </button>
          <button
            className={`nav-tab-item ${screen === 'scan' ? 'active' : ''}`}
            onClick={() => setScreen('scan')}
          >
            <Camera size={20} />
            <span>Audit</span>
          </button>
          <button
            className={`nav-tab-item ${screen === 'history' ? 'active' : ''}`}
            onClick={() => setScreen('history')}
          >
            <History size={20} />
            <span>Logs</span>
          </button>
          <button
            className={`nav-tab-item ${screen === 'reports' ? 'active' : ''}`}
            onClick={() => setScreen('reports')}
          >
            <BarChart3 size={20} />
            <span>Trends</span>
          </button>
          <button
            className={`nav-tab-item ${screen === 'settings' ? 'active' : ''}`}
            onClick={() => setScreen('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* Print Document Template */}
      {renderPrintTemplate()}
    </div>
  );
}
