import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, Filter, Calendar, MapPin, SlidersHorizontal } from 'lucide-react';
import { fetchHistory } from '../services/api';
import './HistoryScreen.css';

export default function HistoryScreen({ onBack, onSelectReport }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("All");
  const [selectedScoreRange, setSelectedScoreRange] = useState("All");
  const [selectedDateFilter, setSelectedDateFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await fetchHistory();
        setHistory(data);
      } catch (err) {
        console.error("Failed to fetch inspection history", err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Very Clean': return 'badge-very-clean';
      case 'Clean': return 'badge-clean';
      case 'Needs Attention': return 'badge-attention';
      case 'Dirty': return 'badge-dirty';
      default: return 'badge-clean';
    }
  };

  // Filter & Search Logic
  const filteredHistory = history.filter(item => {
    // 1. Search term match
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      item.inspectorName.toLowerCase().includes(term) ||
      item.bathroomId.toLowerCase().includes(term) ||
      item.hospitalName.toLowerCase().includes(term) ||
      item.roomNumber.toLowerCase().includes(term);

    // 2. Block filter match
    const matchesBlock = selectedBlock === "All" || item.block.toUpperCase() === selectedBlock.toUpperCase();

    // 3. Score range match
    let matchesScore = true;
    if (selectedScoreRange === "Excellent") matchesScore = item.score >= 90;
    else if (selectedScoreRange === "Good") matchesScore = item.score >= 70 && item.score < 90;
    else if (selectedScoreRange === "Attention") matchesScore = item.score >= 45 && item.score < 70;
    else if (selectedScoreRange === "Poor") matchesScore = item.score < 45;

    // 4. Date filter match
    let matchesDate = true;
    const itemDate = new Date(item.timestamp);
    const today = new Date();
    
    if (selectedDateFilter === "Today") {
      matchesDate = itemDate.toDateString() === today.toDateString();
    } else if (selectedDateFilter === "Week") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      matchesDate = itemDate >= sevenDaysAgo;
    }

    return matchesSearch && matchesBlock && matchesScore && matchesDate;
  });

  return (
    <div className="history-screen animate-fade">
      <div className="history-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2 className="screen-title">Inspection Logs</h2>
      </div>

      {/* Search & Filter Trigger Bar */}
      <div className="search-filter-container">
        <div className="search-bar-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search inspector, room, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          className={`filter-toggle-btn ${showFilters ? 'active-toggle' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="filter-panel glass-card animate-slide-up">
          <div className="filter-row">
            <span className="filter-lbl">Building Block:</span>
            <div className="filter-options">
              {["All", "A", "B", "C"].map(b => (
                <button
                  key={b}
                  className={`filter-chip ${selectedBlock === b ? 'chip-active' : ''}`}
                  onClick={() => setSelectedBlock(b)}
                >
                  {b === "All" ? "All Blocks" : `Block ${b}`}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-lbl">Hygiene Level:</span>
            <div className="filter-options">
              {[
                { key: "All", lbl: "All Scores" },
                { key: "Excellent", lbl: "Excellent (90+)" },
                { key: "Good", lbl: "Good (70-89)" },
                { key: "Attention", lbl: "Attention (45-69)" },
                { key: "Poor", lbl: "Poor (<45)" }
              ].map(s => (
                <button
                  key={s.key}
                  className={`filter-chip ${selectedScoreRange === s.key ? 'chip-active' : ''}`}
                  onClick={() => setSelectedScoreRange(s.key)}
                >
                  {s.lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-lbl">Date Frame:</span>
            <div className="filter-options">
              {[
                { key: "All", lbl: "All Dates" },
                { key: "Today", lbl: "Today Only" },
                { key: "Week", lbl: "Last 7 Days" }
              ].map(d => (
                <button
                  key={d.key}
                  className={`filter-chip ${selectedDateFilter === d.key ? 'chip-active' : ''}`}
                  onClick={() => setSelectedDateFilter(d.key)}
                >
                  {d.lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logs Scroll List */}
      <div className="history-list-scroll">
        {loading ? (
          <div className="history-info-state">
            <div className="loading-spinner"></div>
            <p>Loading historical audits...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="history-info-state">
            <Filter size={32} className="text-muted" />
            <p className="state-title">No reports matched</p>
            <p className="state-desc">Try resetting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="history-cards-list">
            {filteredHistory.map((item) => (
              <div 
                key={item.id} 
                className="history-item-card glass-card"
                onClick={() => onSelectReport(item)}
              >
                {/* Thumbnail */}
                <div className="item-thumbnail-wrapper">
                  <img src={item.imageUrl} alt="Thumbnail" className="item-thumbnail" />
                  <div className="item-score-bubble">
                    {item.score}%
                  </div>
                </div>

                {/* Info summary */}
                <div className="item-details">
                  <div className="item-first-row">
                    <span className="item-id-tag">{item.id}</span>
                    <span className={`badge badge-sm ${getStatusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  
                  <div className="item-meta-row">
                    <MapPin size={11} />
                    <span>Block {item.block}, Floor {item.floorNumber}, Room {item.roomNumber}</span>
                  </div>

                  <div className="item-meta-row">
                    <Calendar size={11} />
                    <span>{new Date(item.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>

                  <div className="item-inspector-row">
                    <span>Inspector: <strong>{item.inspectorName}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
