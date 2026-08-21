import React, { useEffect, useState } from 'react';
import { Eye, ShieldCheck, Loader2 } from 'lucide-react';
import './ProcessingScreen.css';

const STAGES = [
  "Loading AI Model...",
  "Detecting Bathroom...",
  "Analyzing Cleanliness...",
  "Calculating Score...",
  "Generating Report..."
];

export default function ProcessingScreen({ imageSrc }) {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  useEffect(() => {
    // Cycle through messages every 480ms to finish all 5 stages in ~2.4 seconds
    const interval = setInterval(() => {
      setCurrentStageIdx(prev => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 480);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="processing-screen animate-fade">
      <div className="processing-main-card glass-card">
        {/* Holographic scanning viewfinder */}
        <div className="scanning-container">
          {imageSrc && <img src={imageSrc} alt="Analyzing" className="scanning-img" />}
          <div className="scanning-overlay">
            <div className="laser-beam"></div>
            <div className="matrix-grid"></div>
            <div className="scanning-viewfinder">
              <div className="v-bracket top-left"></div>
              <div className="v-bracket top-right"></div>
              <div className="v-bracket bottom-left"></div>
              <div className="v-bracket bottom-right"></div>
            </div>
            <div className="hologram-label">
              <Eye size={14} className="hologram-pulse-icon" />
              <span>LIVE CV RUN</span>
            </div>
          </div>
        </div>

        {/* Status progress panel */}
        <div className="processing-status-panel">
          <div className="loading-spinner-wrapper">
            <Loader2 className="processing-spinner" size={24} />
          </div>
          
          <h3 className="processing-title">Computer Vision Analysis</h3>
          <p className="processing-desc">CleanVision neural engine is auditing surfaces...</p>
          
          <div className="stages-timeline">
            {STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIdx;
              const isActive = idx === currentStageIdx;
              
              return (
                <div key={idx} className={`stage-row ${isPast ? 'stage-past' : ''} ${isActive ? 'stage-active' : ''}`}>
                  <div className="stage-dot-wrapper">
                    {isPast ? (
                      <div className="stage-dot-checked">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-full">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="stage-dot"></div>
                    )}
                  </div>
                  <span className="stage-text">{stage}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
