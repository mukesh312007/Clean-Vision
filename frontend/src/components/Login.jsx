import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginUser } from '../services/api';
import './Login.css';

const DEMO_ACCOUNTS = [
  { label: 'Anonymous 1 (Admin)',     email: 'admin@hospital.com',  password: 'Admin@123',     role: 'admin' },
  { label: 'Anonymous 2 (Supervisor)', email: 'sarah@hospital.com',   password: 'Supervisor@123', role: 'supervisor' },
  { label: 'Anonymous 4 (Manager)',   email: 'maria@hospital.com',   password: 'Manager@123',   role: 'manager' },
];

export default function Login({ onLogin, onOpenClientPortal }) {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showDemo,    setShowDemo]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email address.'); return; }

    setLoading(true);
    try {
      const user = await loginUser(email.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setShowDemo(false);
    setError('');
  };

  return (
    <div className="login-screen animate-fade">
      <div className="login-header">
        <div className="app-brand">
          <div className="brand-icon">
            <ShieldCheck size={28} className="brand-svg" />
          </div>
          <span className="brand-name">CleanVision</span>
        </div>

        {/* Visitor QR Portal Button (No Login Required) */}
        <button 
          type="button" 
          className="visitor-qr-banner-btn"
          onClick={onOpenClientPortal}
        >
          <div className="visitor-banner-icon">📱</div>
          <div className="visitor-banner-texts">
            <span className="visitor-banner-title">← Back to Patient / Visitor QR Portal</span>
            <span className="visitor-banner-sub">Return to public complaint scanner</span>
          </div>
        </button>

        <h2 className="login-title">Hospital Worker Login</h2>
        <p className="login-subtitle">Housekeeping & Operations Staff Portal</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form" noValidate>
        {error && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Hospital Email</label>
          <div className="input-with-icon">
            <Mail className="input-icon" size={18} aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder="name@hospital.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <div className="input-with-icon">
            <Lock className="input-icon" size={18} aria-hidden="true" />
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              disabled={loading}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          className="btn btn-primary login-btn"
          disabled={loading}
        >
          {loading
            ? <span className="spinner-dots"><span>.</span><span>.</span><span>.</span></span>
            : 'Sign In to Workspace'}
        </button>
      </form>

      {/* Demo accounts accordion */}
      <div className="demo-section">
        <button
          type="button"
          className="demo-toggle-btn"
          onClick={() => setShowDemo(!showDemo)}
        >
          {showDemo ? '▲' : '▼'} &nbsp;Show demo accounts
        </button>
        {showDemo && (
          <div className="demo-accounts-list animate-slide-up">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="demo-account-item"
                onClick={() => fillDemo(acc)}
              >
                <div className={`demo-role-badge role-${acc.role}`}>{acc.role}</div>
                <div className="demo-account-info">
                  <span className="demo-name">{acc.label}</span>
                  <span className="demo-email">{acc.email}</span>
                </div>
                <span className="demo-tap">Tap to fill</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="login-footer">
        <ShieldCheck size={12} />
        <span>Secured by CleanVision Auth · SQLite encrypted storage</span>
      </div>
    </div>
  );
}
