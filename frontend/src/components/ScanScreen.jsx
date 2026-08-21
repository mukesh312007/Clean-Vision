import React, { useState, useEffect } from 'react';
import { ArrowLeft, Camera, AlertCircle, RefreshCw, Lock, ShieldCheck, LockKeyhole } from 'lucide-react';
import CameraViewfinder from './CameraViewfinder';
import './ScanScreen.css';

export default function ScanScreen({ user, onBack, onStartInspection }) {
  const [formData, setFormData] = useState({
    hospitalName: "City General Hospital",
    block: "A",
    floorNumber: "1",
    roomNumber: "101",
    bathroomId: "CGH-A-101-B1",
    inspectorName: user?.name || "Sarah Jenkins"
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState("");

  // Sync Bathroom ID automatically
  useEffect(() => {
    const hospAbbr = formData.hospitalName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
    const cleanBlock = formData.block.trim().toUpperCase() || 'X';
    const cleanFloor = formData.floorNumber.trim() || '0';
    const cleanRoom = formData.roomNumber.trim() || '00';
    
    setFormData(prev => ({
      ...prev,
      bathroomId: `${hospAbbr}-${cleanBlock}-${cleanFloor}${cleanRoom}-B1`
    }));
  }, [formData.hospitalName, formData.block, formData.floorNumber, formData.roomNumber]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCameraCapture = (previewUrl, fileObj) => {
    setSelectedImage(previewUrl);
    setImageFile(fileObj);
    setShowCamera(false);
    setError("");
  };

  const handleStartInspection = () => {
    setError("");
    
    // Validation
    if (!formData.hospitalName || !formData.block || !formData.floorNumber || !formData.roomNumber) {
      setError("Please fill out all facility location details.");
      return;
    }
    if (!selectedImage || !imageFile) {
      setError("Please capture a live bathroom photo with your device camera.");
      return;
    }

    onStartInspection(formData, imageFile);
  };

  return (
    <div className="scan-screen animate-fade">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2 className="screen-title">Cleanliness Audit</h2>
      </div>

      <div className="scan-content-scroll">
        {/* Privacy Compliance Banner */}
        <div className="privacy-enforced-banner glass-card animate-slide-down">
          <div className="privacy-banner-icon">
            <LockKeyhole size={20} className="text-primary" />
          </div>
          <div className="privacy-banner-text">
            <h4>Privacy Standard Enforced</h4>
            <p>Device gallery file uploads are disabled. Photos must be captured live using the camera.</p>
          </div>
        </div>

        {error && (
          <div className="error-alert animate-slide-up">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Facility Metadata Card */}
        <div className="section-card glass-card">
          <h3 className="section-card-title">Facility Details</h3>
          
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label className="form-label">Facility/Hospital</label>
              <input
                type="text"
                className="form-control"
                name="hospitalName"
                value={formData.hospitalName}
                readOnly
                style={{ backgroundColor: 'var(--bg-tertiary)', fontWeight: '600' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Block</label>
              <input 
                type="text" 
                className="form-control" 
                name="block" 
                maxLength={2}
                placeholder="A" 
                value={formData.block} 
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Floor</label>
              <input 
                type="number" 
                className="form-control" 
                name="floorNumber" 
                min={0}
                placeholder="1" 
                value={formData.floorNumber} 
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Room No.</label>
              <input 
                type="text" 
                className="form-control" 
                name="roomNumber" 
                placeholder="101" 
                value={formData.roomNumber} 
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bathroom ID</label>
              <input 
                type="text" 
                className="form-control" 
                name="bathroomId" 
                readOnly
                value={formData.bathroomId} 
                style={{ backgroundColor: 'var(--bg-tertiary)', fontWeight: 'bold' }}
              />
            </div>

            <div className="form-group col-span-2">
              <label className="form-label">Inspector Name</label>
              <div className="locked-field-wrapper">
                <Lock size={14} className="locked-icon" />
                <input 
                  type="text" 
                  className="form-control locked-input" 
                  name="inspectorName" 
                  value={formData.inspectorName} 
                  readOnly
                  style={{ backgroundColor: 'var(--bg-tertiary)', fontWeight: '600', paddingLeft: '36px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Live Camera Capture Section */}
        <div className="section-card glass-card">
          <h3 className="section-card-title">Live Bathroom Camera Capture</h3>
          
          {!selectedImage ? (
            <button className="upload-box upload-box-full live-camera-trigger-box" onClick={() => setShowCamera(true)}>
              <div className="upload-box-icon camera-pulse">
                <Camera size={34} />
              </div>
              <span className="upload-box-title">Tap to Open Live Camera</span>
              <span className="upload-box-desc">Requires live photo capture of bathroom floor/surfaces</span>
              <div className="live-camera-badge">
                <ShieldCheck size={13} />
                <span>Live Viewfinder Only</span>
              </div>
            </button>
          ) : (
            <div className="image-preview-container">
              <img src={selectedImage} alt="Captured bathroom preview" className="image-preview" />
              <div className="preview-overlay-guide">
                <div className="guide-box"></div>
              </div>
              <button className="change-image-btn" onClick={() => setShowCamera(true)}>
                <RefreshCw size={14} /> Retake Photo
              </button>
            </div>
          )}
        </div>

        {/* Action button */}
        <button 
          className="btn btn-primary start-inspect-btn" 
          onClick={handleStartInspection}
        >
          <Camera size={18} /> Start AI Inspection
        </button>
      </div>

      {/* Camera Viewfinder Modal */}
      {showCamera && (
        <CameraViewfinder
          title="Capture Inspection Photo"
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
