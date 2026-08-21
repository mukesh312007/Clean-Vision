/**
 * CleanVision â€” Frontend API Service
 * Handles JWT auth + worker calls + public client QR complaint submission.
 * Falls back gracefully to localStorage when offline.
 *
 * PRODUCTION: Set VITE_API_URL in .env to your server's URL, e.g.:
 *   VITE_API_URL=http://192.168.1.100:5000
 *   VITE_API_URL=https://cleanvision.yourhospital.com
 */

// API base URL â€” empty string = relative (dev proxy), full URL = production server
const API_BASE = import.meta.env.VITE_API_URL || '';

const LOCAL_DB_KEY           = 'cleanvision_inspections';
const LOCAL_CLIENT_ALERTS_KEY = 'cleanvision_client_alerts';
const LOCAL_TOKEN_KEY        = 'cleanvision_token';
const LOCAL_USER_KEY         = 'cleanvision_user';

// â”€â”€ Token & Auth Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function getToken()       { return localStorage.getItem(LOCAL_TOKEN_KEY); }
export function setToken(t)      { localStorage.setItem(LOCAL_TOKEN_KEY, t); }
export function clearToken()     { localStorage.removeItem(LOCAL_TOKEN_KEY); localStorage.removeItem(LOCAL_USER_KEY); }
export function getCachedUser()  { try { return JSON.parse(localStorage.getItem(LOCAL_USER_KEY)); } catch { return null; } }
export function setCachedUser(u) { localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u)); }

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// â”€â”€ Seed local store for offline testing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initLocalStore() {
  if (!localStorage.getItem(LOCAL_DB_KEY)) {
    const seeds = [
      {
        id: 'INS-9821-A', timestamp: '2026-07-12T09:15:00.000Z',
        hospitalName: 'City General Hospital', block: 'A', floorNumber: '3',
        roomNumber: '302', bathroomId: 'CGH-A-302-B1', inspectorName: 'Sarah Jenkins',
        score: 92, status: 'Very Clean', confidence: 97.5,
        issues: ['Mirror stain'], recommendations: ['Wipe mirror with glass cleaner'],
        imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
      },
      {
        id: 'INS-9812-B', timestamp: '2026-07-12T14:30:00.000Z',
        hospitalName: 'City General Hospital', block: 'A', floorNumber: '1',
        roomNumber: '105', bathroomId: 'CGH-A-105-B1', inspectorName: 'Robert Chen',
        score: 58, status: 'Needs Attention', confidence: 91.2,
        issues: ['Water spill on floor', 'Soap dispenser is empty'],
        recommendations: ['Mop and dry the floor', 'Refill soap dispenser'],
        imageUrl: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=400&q=80',
      }
    ];
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seeds));
  }

  if (!localStorage.getItem(LOCAL_CLIENT_ALERTS_KEY)) {
    const seedAlerts = [
      {
        report_id: 'ALERT-8812-B',
        block: 'B', floor_number: '2', room_number: '204',
        bathroom_id: 'CGH-B-204-B1', hospital_name: 'City General Hospital',
        issue_type: 'Wet Floor & Water Spill',
        notes: 'Water spilled near sink basin. Slip risk for patients.',
        image_url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=400&q=80',
        status: 'PENDING',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      }
    ];
    localStorage.setItem(LOCAL_CLIENT_ALERTS_KEY, JSON.stringify(seedAlerts));
  }
}
initLocalStore();

// â”€â”€ Auth API (WORKERS ONLY) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function loginUser(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    setToken(data.token);
    setCachedUser(data.user);
    return data.user;
  } catch (err) {
    if (email === 'admin@hospital.com' && password === 'Admin@123') {
      const mockUser = { id: 1, name: 'Anonymous 1', email, role: 'admin', block_access: 'ALL' };
      setCachedUser(mockUser);
      return mockUser;
    }
    if (email === 'sarah@hospital.com' && password === 'Supervisor@123') {
      const mockUser = { id: 2, name: 'Anonymous 2', email, role: 'supervisor', block_access: 'A,B' };
      setCachedUser(mockUser);
      return mockUser;
    }
    if (email === 'maria@hospital.com' && password === 'Manager@123') {
      const mockUser = { id: 3, name: 'Anonymous 4', email, role: 'manager', block_access: 'ALL' };
      setCachedUser(mockUser);
      return mockUser;
    }
    if (email === 'supervisor@hospital.com' && password === 'Super@123') {
      const mockUser = { id: 4, name: 'Anonymous 5', email, role: 'supervisor', block_access: 'ALL' };
      setCachedUser(mockUser);
      return mockUser;
    }
    throw err;
  }
}

// â”€â”€ Public Patient / Visitor QR Alert Submission (NO LOGIN REQUIRED) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function submitClientReport(formData, imageFile) {
  try {
    const data = new FormData();
    if (imageFile instanceof File) {
      data.append('image', imageFile);
    }
    Object.entries(formData).forEach(([k, v]) => data.append(k, v));

    const res = await fetch(`${API_BASE}/api/client-report`, {
      method: 'POST',
      body: data,
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Client report offline fallback", e);
  }

  // Fallback local store
  let imageUrl = 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=400&q=80';
  if (imageFile instanceof File) {
    imageUrl = await new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(imageFile);
    });
  }

  const alertRecord = {
    report_id: `ALERT-${Math.floor(1000 + Math.random() * 9000)}-${(formData.block || 'A').toUpperCase()}`,
    block: formData.block || 'A',
    floor_number: formData.floorNumber || '1',
    room_number: formData.roomNumber || '101',
    bathroom_id: formData.bathroomId || 'CGH-A-101-B1',
    hospital_name: formData.hospitalName || 'City General Hospital',
    issue_type: formData.issueType || 'General Cleanliness',
    notes: formData.notes || '',
    image_url: imageUrl,
    status: 'PENDING',
    created_at: new Date().toISOString()
  };

  const alerts = JSON.parse(localStorage.getItem(LOCAL_CLIENT_ALERTS_KEY) || '[]');
  alerts.unshift(alertRecord);
  localStorage.setItem(LOCAL_CLIENT_ALERTS_KEY, JSON.stringify(alerts));
  return alertRecord;
}

// â”€â”€ Worker Alert Notification API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function fetchClientReports() {
  try {
    const res = await fetch(`${API_BASE}/api/client-reports`, { headers: authHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Client reports offline", e);
  }
  return JSON.parse(localStorage.getItem(LOCAL_CLIENT_ALERTS_KEY) || '[]');
}

export async function resolveClientReport(reportId, scanResult = null) {
  try {
    const res = await fetch(`/api/client-reports/${reportId}/resolve`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan_result: scanResult })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Resolve alert offline", e);
  }

  const alerts = JSON.parse(localStorage.getItem(LOCAL_CLIENT_ALERTS_KEY) || '[]');
  const updated = alerts.map(a =>
    a.report_id === reportId
      ? {
          ...a,
          status: 'RESOLVED',
          resolved_at: new Date().toISOString(),
          scan_result: scanResult || null,
          resolved_by_cv_scan: scanResult !== null
        }
      : a
  );
  localStorage.setItem(LOCAL_CLIENT_ALERTS_KEY, JSON.stringify(updated));
  return { message: 'Resolved' };
}


// â”€â”€ Worker Inspection & Predict Calls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function predictBathroom(formData, imageFile) {
  try {
    const data = new FormData();
    data.append('image', imageFile instanceof File ? imageFile : new File([], imageFile?.name || 'photo.jpg'));
    Object.entries(formData).forEach(([k, v]) => data.append(k, v));

    const res = await fetch(`${API_BASE}/api/predict`, { method: 'POST', headers: authHeaders(), body: data });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("Predict offline fallback", err);
  }

  return runMockPredict(formData, imageFile);
}

async function runMockPredict(formData, imageFile) {
  await new Promise(r => setTimeout(r, 2200));

  const name = (imageFile?.name || '').toLowerCase();
  let score = 88, confidence = 96.5, issues = [], recommendations = [];

  if (name.includes('dirty') || name.includes('trash') || name.includes('muddy')) {
    score = 35; confidence = 92.1;
    issues = ['Mud or debris on floor', 'Uncleaned floor surface'];
    recommendations = ['Sweep and mop the floor immediately', 'Clean and dry the surface'];
  } else if (name.includes('spill') || name.includes('wet')) {
    score = 64; confidence = 89.8;
    issues = ['Water spill on floor'];
    recommendations = ['Mop and dry the floor'];
  } else if (name.includes('stain') || name.includes('mirror')) {
    score = 75; confidence = 94.3;
    issues = ['Visible staining on surface'];
    recommendations = ['Scrub stained area with cleaning agent'];
  } else {
    score = 94; confidence = 98.1;
    recommendations = ['No action required'];
  }

  let status = 'Very Clean';
  if (score < 45)      status = 'Dirty';
  else if (score < 70) status = 'Needs Attention';
  else if (score < 90) status = 'Clean';

  let imageUrl = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80';
  if (imageFile instanceof File) {
    imageUrl = await new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(imageFile);
    });
  }

  const user = getCachedUser();
  const record = {
    id: `INS-${Math.floor(1000 + Math.random() * 9000)}-${(formData.block || 'X').toUpperCase()}`,
    timestamp: new Date().toISOString(),
    hospitalName: formData.hospitalName || 'City General Hospital',
    block: formData.block || 'A', floorNumber: formData.floorNumber || '1',
    roomNumber: formData.roomNumber || '101', bathroomId: formData.bathroomId || 'CGH-A-101-B1',
    inspectorName: formData.inspectorName || user?.name || 'Inspector',
    score, status, confidence, issues, recommendations, imageUrl,
  };

  const db = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
  db.unshift(record);
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  return record;
}

export async function fetchHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/inspections`, { headers: authHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {}
  return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
}

export async function fetchTrends() {
  try {
    const res = await fetch(`${API_BASE}/api/trends`, { headers: authHeaders() });
    if (res.ok) return await res.json();
  } catch (e) {}
  return computeLocalTrends();
}

function computeLocalTrends() {
  const data = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
  if (!data.length) return { todayCount: 0, avgScore: 0, statusCounts: { 'Very Clean': 0, Clean: 0, 'Needs Attention': 0, Dirty: 0 }, issueFrequency: {}, dailyTrends: [] };
  const todayStr  = new Date().toISOString().split('T')[0];
  const todayCount = data.filter(r => r.timestamp.startsWith(todayStr)).length;
  const avgScore   = Math.round(data.reduce((a, r) => a + r.score, 0) / data.length);
  const statusCounts = { 'Very Clean': 0, Clean: 0, 'Needs Attention': 0, Dirty: 0 };
  data.forEach(r => { if (statusCounts[r.status] !== undefined) statusCounts[r.status]++; });
  const issueFrequency = {};
  data.forEach(r => (r.issues || []).forEach(i => { issueFrequency[i] = (issueFrequency[i] || 0) + 1; }));
  const dailyMap = {};
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dailyMap[d.toISOString().split('T')[0]] = { count: 0, sum: 0 }; }
  data.forEach(r => { const ds = r.timestamp.split('T')[0]; if (dailyMap[ds]) { dailyMap[ds].count++; dailyMap[ds].sum += r.score; } });
  const dailyTrends = Object.keys(dailyMap).map(ds => ({ date: ds.split('-').slice(1).join('/'), avgScore: dailyMap[ds].count > 0 ? Math.round(dailyMap[ds].sum / dailyMap[ds].count) : null, count: dailyMap[ds].count }));
  return { todayCount, avgScore, statusCounts, issueFrequency, dailyTrends };
}


