import React, { useState } from 'react';
import { ArrowLeft, Moon, Sun, Bell, Globe, LogOut } from 'lucide-react';
import './SettingsScreen.css';

export default function SettingsScreen({ user, theme, onToggleTheme, onBack, onLogout }) {
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("English");

  const toggleNotifications = () => {
    setNotifications(!notifications);
  };

  return (
    <div className="settings-screen animate-fade">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2 className="screen-title">System Settings</h2>
      </div>

      <div className="settings-content-scroll">
        {/* Profile Card Summary */}
        <div className="settings-profile-card glass-card">
          <div className="avatar-large">
            {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'UI'}
          </div>
          <div className="profile-info">
            <h3 className="profile-name">{user.name || 'Anonymous Worker'}</h3>
            <span className="profile-role">{user.role || 'Facility Staff'}</span>
            <span className="profile-email">{user.email || 'guest@cleanvision.org'}</span>
          </div>
        </div>

        {/* Preferences Section */}
        <h4 className="settings-section-lbl">App Preferences</h4>
        <div className="settings-group glass-card">
          {/* Theme Switcher */}
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-icon-box theme-icon">
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </div>
              <div className="settings-row-texts">
                <span className="settings-row-title">Dark Interface Mode</span>
                <span className="settings-row-desc">Enhances readability in low light</span>
              </div>
            </div>
            <label className="switch-control">
              <input 
                type="checkbox" 
                checked={theme === 'dark'} 
                onChange={onToggleTheme} 
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          {/* Notifications Switch */}
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-icon-box alert-icon">
                <Bell size={18} />
              </div>
              <div className="settings-row-texts">
                <span className="settings-row-title">Push Notifications</span>
                <span className="settings-row-desc">Alerts for visitor complaints & low scores</span>
              </div>
            </div>
            <label className="switch-control">
              <input 
                type="checkbox" 
                checked={notifications} 
                onChange={toggleNotifications} 
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          {/* Language Selector (English, Tamil, Hindi) */}
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-icon-box lang-icon">
                <Globe size={18} />
              </div>
              <div className="settings-row-texts">
                <span className="settings-row-title">Workspace Language</span>
                <span className="settings-row-desc">Current language for inspections UI</span>
              </div>
            </div>
            <select 
              className="lang-dropdown"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="English">English</option>
              <option value="Tamil">Tamil (தமிழ்)</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
            </select>
          </div>
        </div>

        {/* Logout button */}
        <button className="btn logout-action-btn" onClick={onLogout}>
          <LogOut size={16} /> Sign Out of Workspace
        </button>
      </div>
    </div>
  );
}
