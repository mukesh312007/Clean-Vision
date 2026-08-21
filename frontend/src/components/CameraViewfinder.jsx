import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, ShieldAlert, SwitchCamera, Check } from 'lucide-react';
import './CameraViewfinder.css';

export default function CameraViewfinder({ onCapture, onClose, title = "Capture Bathroom Photo" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // default to rear camera for mobile
  const [cameraError, setCameraError] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);

  // Initialize camera stream
  const startCamera = async (mode) => {
    setIsInitializing(true);
    setCameraError('');

    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsInitializing(false);
    } catch (err) {
      console.warn("Camera access fallback:", err);
      // Fallback to basic video constraint if exact facingMode failed
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
        setIsInitializing(false);
      } catch (fallbackErr) {
        console.error("Camera permission denied or camera missing:", fallbackErr);
        setCameraError("Camera access denied or unavailable. Please grant camera permission in your browser settings to take inspection photos.");
        setIsInitializing(false);
      }
    }
  };

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // Toggle Front / Back camera
  const handleToggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Take Snapshot from video frame
  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPreview(dataUrl);

    // Convert dataUrl to File object
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `live_inspection_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedFile(file);
      }
    }, 'image/jpeg', 0.92);
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setCapturedFile(null);
  };

  const handleConfirm = () => {
    if (capturedPreview && capturedFile) {
      // Stop camera tracks before closing
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      onCapture(capturedPreview, capturedFile);
    }
  };

  const handleCancel = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="camera-modal-overlay animate-fade">
      <div className="camera-modal-content">
        {/* Header */}
        <div className="camera-modal-header">
          <div className="header-privacy-tag">
            <ShieldAlert size={15} />
            <span>Privacy Standard: Live Camera Only</span>
          </div>
          <button className="camera-close-btn" onClick={handleCancel} title="Close Camera">
            <X size={20} />
          </button>
        </div>

        {/* Viewfinder Body */}
        <div className="camera-viewfinder-body">
          {cameraError ? (
            <div className="camera-error-state">
              <ShieldAlert size={44} className="text-danger" />
              <h3>Camera Access Blocked</h3>
              <p>{cameraError}</p>
              <button className="btn btn-primary" onClick={() => startCamera(facingMode)} style={{ marginTop: '12px' }}>
                <RefreshCw size={16} /> Retry Camera
              </button>
            </div>
          ) : capturedPreview ? (
            /* Review Snapshot */
            <div className="camera-preview-wrapper">
              <img src={capturedPreview} alt="Captured snapshot" className="snapshot-img" />
              <div className="snapshot-badge">Photo Captured</div>
            </div>
          ) : (
            /* Live Stream Video */
            <div className="live-video-wrapper">
              {isInitializing && (
                <div className="camera-loading-spinner">
                  <RefreshCw size={28} className="spin-icon" />
                  <span>Opening Device Camera...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="live-video-element"
              />
              {/* Alignment Frame Target */}
              <div className="viewfinder-grid-overlay">
                <div className="corner-bracket top-left"></div>
                <div className="corner-bracket top-right"></div>
                <div className="corner-bracket bottom-left"></div>
                <div className="corner-bracket bottom-right"></div>
                <div className="center-target-reticle"></div>
                <span className="reticle-label">Align bathroom/floor area</span>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Footer Actions */}
        <div className="camera-modal-footer">
          {capturedPreview ? (
            <div className="snapshot-action-buttons">
              <button className="btn btn-secondary retake-btn" onClick={handleRetake}>
                <RefreshCw size={16} /> Retake
              </button>
              <button className="btn btn-primary confirm-btn" onClick={handleConfirm}>
                <Check size={16} /> Use Photo
              </button>
            </div>
          ) : (
            <div className="live-camera-controls">
              <button className="cam-control-btn flip-btn" onClick={handleToggleCamera} title="Switch Front/Back Camera">
                <SwitchCamera size={20} />
              </button>
              <button className="shutter-button" onClick={handleTakeSnapshot} title="Capture Photo">
                <div className="shutter-inner-ring"></div>
              </button>
              <div style={{ width: '40px' }}></div> {/* Spacer */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
