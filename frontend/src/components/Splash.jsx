import React, { useEffect, useState } from 'react';
import './Splash.css';

export default function Splash({ onFinish }) {
  const [fadeClass, setFadeClass] = useState('splash-visible');

  useEffect(() => {
    // Wait 2.2 seconds before starting fade out
    const fadeTimer = setTimeout(() => {
      setFadeClass('splash-fade-out');
    }, 2200);

    // Call onFinish when animation is fully done
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-screen ${fadeClass}`}>
      <div className="splash-content">
        <div className="logo-container">
          <div className="pulse-ring ring-1"></div>
          <div className="pulse-ring ring-2"></div>
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="svg-logo">
              <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z" fill="var(--primary)" fillOpacity="0.15" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="var(--primary)" stroke="var(--primary)" strokeWidth="0.5"/>
              <circle cx="12" cy="12" r="1.5" fill="var(--text-on-accent)"/>
              <path d="M8.5 12.5l2 2 5-5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <h1 className="splash-title">CleanVision</h1>
        <p className="splash-subtitle">AI Bathroom Inspection System</p>
      </div>
      <div className="splash-footer">
        <span className="footer-v">v1.2.0</span>
        <span className="footer-corp">Healthcare Facility Operations</span>
      </div>
    </div>
  );
}
