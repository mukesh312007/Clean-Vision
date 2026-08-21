import React, { useEffect, useState } from 'react';
import { ArrowLeft, Printer, FileDown, ShieldAlert, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';
import { fetchTrends } from '../services/api';
import './ReportsScreen.css';

export default function ReportsScreen({ onBack }) {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrends() {
      try {
        const data = await fetchTrends();
        setTrends(data);
      } catch (err) {
        console.error("Failed to load hygiene trends", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="reports-screen">
        <div className="reports-header">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="screen-title">Hygiene Reports</h2>
        </div>
        <div className="reports-loading">
          <div className="loading-spinner"></div>
          <p>Compiling sanitation statistics...</p>
        </div>
      </div>
    );
  }

  const { todayCount, avgScore, statusCounts, issueFrequency, dailyTrends } = trends;
  
  // Calculate total audits
  const totalAudits = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // SVG Chart Calculations for 7-day average score
  const chartHeight = 120;
  const chartWidth = 320;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 20;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Generate chart path
  let chartPath = "";
  let chartAreaPath = "";
  const points = [];

  if (dailyTrends && dailyTrends.length > 0) {
    dailyTrends.forEach((day, idx) => {
      const val = day.avgScore || 75; // fallback
      const x = paddingLeft + (idx / (dailyTrends.length - 1)) * graphWidth;
      const y = paddingTop + graphHeight - ((val - 30) / 70) * graphHeight; // scale 30% to 100%
      points.push({ x, y, score: val, label: day.date });
    });

    chartPath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    chartAreaPath = `${chartPath} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${points[0].x} ${paddingTop + graphHeight} Z`;
  }

  return (
    <div className="reports-screen animate-fade">
      <div className="reports-header no-print">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2 className="screen-title">hygiene analytics</h2>
      </div>

      <div className="reports-content-scroll">
        {/* Manager Banner */}
        <div className="reports-manager-card glass-card">
          <div className="manager-intro">
            <span className="manager-title">Hygiene Quality Report</span>
            <span className="manager-date">Compiled: {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
          </div>
          <button className="btn btn-primary print-export-btn no-print" onClick={handlePrint}>
            <Printer size={16} /> Export PDF Report
          </button>
        </div>

        {/* Core KPIs Row */}
        <div className="reports-kpi-grid">
          <div className="kpi-card glass-card">
            <TrendingUp size={20} className="kpi-icon text-info" />
            <span className="kpi-label">Sanitation Index</span>
            <span className="kpi-value">{avgScore}%</span>
            <span className="kpi-sub">Overall facility avg</span>
          </div>
          <div className="kpi-card glass-card">
            <CheckCircle2 size={20} className="kpi-icon text-success" />
            <span className="kpi-label">Total Audited</span>
            <span className="kpi-value">{totalAudits}</span>
            <span className="kpi-sub">Inspection records</span>
          </div>
          <div className="kpi-card glass-card">
            <Calendar size={20} className="kpi-icon text-warning" />
            <span className="kpi-label">Today's Audits</span>
            <span className="kpi-value">{todayCount}</span>
            <span className="kpi-sub">Completed audits</span>
          </div>
        </div>

        {/* 1. 7-Day Line Trend Chart */}
        <div className="section-card glass-card chart-section-card">
          <h3 className="section-card-title">Cleanliness Trends (7 Days)</h3>
          <div className="svg-chart-container">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="trend-svg">
              {/* Horizontal Grid lines */}
              {[30, 50, 70, 90].map((gridVal, i) => {
                const y = paddingTop + graphHeight - ((gridVal - 30) / 70) * graphHeight;
                return (
                  <g key={i}>
                    <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} className="chart-grid-line" />
                    <text x={paddingLeft - 6} y={y + 3} className="chart-axis-text" textAnchor="end">{gridVal}%</text>
                  </g>
                );
              })}

              {/* Area under curve */}
              {chartAreaPath && <path d={chartAreaPath} className="chart-area-fill" />}

              {/* Trend Line */}
              {chartPath && <path d={chartPath} className="chart-trend-line" />}

              {/* Data points */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="3.5" className="chart-point" />
                  <circle cx={p.x} cy={p.y} r="7" className="chart-point-ring" />
                  {/* Score tooltip text */}
                  <text x={p.x} y={p.y - 8} className="chart-point-label" textAnchor="middle">{p.score}%</text>
                  {/* Axis date label */}
                  <text x={p.x} y={paddingTop + graphHeight + 14} className="chart-axis-lbl" textAnchor="middle">{p.label}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* 2. Hygiene Distribution Horizontal Stack */}
        <div className="section-card glass-card distribution-card">
          <h3 className="section-card-title">Hygiene Level Distribution</h3>
          <div className="distribution-ratio-bar">
            {Object.entries(statusCounts).map(([status, count]) => {
              if (count === 0) return null;
              const pct = (count / totalAudits) * 100;
              let colorClass = "bg-info";
              if (status === "Very Clean") colorClass = "bg-success";
              else if (status === "Needs Attention") colorClass = "bg-warning";
              else if (status === "Dirty") colorClass = "bg-danger";

              return (
                <div 
                  key={status} 
                  className={`ratio-segment ${colorClass}`} 
                  style={{ width: `${pct}%` }}
                  title={`${status}: ${count} (${Math.round(pct)}%)`}
                ></div>
              );
            })}
          </div>

          <div className="distribution-legend">
            {Object.entries(statusCounts).map(([status, count]) => {
              let dotClass = "dot-ok";
              if (status === "Very Clean") dotClass = "dot-success";
              else if (status === "Needs Attention") dotClass = "dot-warning";
              else if (status === "Dirty") dotClass = "dot-danger";
              
              const pct = totalAudits > 0 ? Math.round((count / totalAudits) * 100) : 0;

              return (
                <div key={status} className="legend-item">
                  <div className={`legend-dot ${dotClass}`}></div>
                  <span className="legend-lbl">{status}</span>
                  <span className="legend-val">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Issue Frequency list */}
        <div className="section-card glass-card issues-frequency-card">
          <h3 className="section-card-title">Common Facility Issues</h3>
          {Object.keys(issueFrequency).length === 0 ? (
            <div className="empty-issues-msg">
              <CheckCircle2 size={24} className="text-success" />
              <p>No critical issues detected in recent audits.</p>
            </div>
          ) : (
            <div className="frequency-list">
              {Object.entries(issueFrequency)
                .sort((a, b) => b[1] - a[1])
                .map(([issue, count]) => {
                  const pct = Math.min((count / totalAudits) * 100, 100);
                  return (
                    <div key={issue} className="frequency-row">
                      <div className="freq-info-header">
                        <span className="freq-name">{issue}</span>
                        <span className="freq-count">{count} {count === 1 ? 'time' : 'times'}</span>
                      </div>
                      <div className="freq-progress-bg">
                        <div 
                          className="freq-progress-fill" 
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* 4. Healthcare Trust Disclaimer */}
        <div className="reports-footer-disclaimer no-print">
          <ShieldAlert size={14} />
          <span>This report is generated for sanitation auditing. All scores are processed by CleanVision's neural model.</span>
        </div>
      </div>
    </div>
  );
}
