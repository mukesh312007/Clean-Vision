/**
 * CleanVision — Modular Computer Vision Service
 * ================================================
 * This service has TWO modes, selected automatically at startup:
 *
 *  MODE A — ONNX (Real Model)
 *    Triggered when: server/model/cleanvision.onnx exists
 *    Runs the trained YOLOv8 model via onnxruntime-node.
 *    Detects: Muddy-Floor, Uncleaned-Floor, Stain, Rusty-Pipes
 *    Rusty-Pipes = 0 penalty (structural, NOT a cleanliness issue).
 *
 *  MODE B — Mock Predictor (Development Fallback)
 *    Triggered when: ONNX model is missing
 *    Returns simulated results based on filename heuristics.
 *    Safe to use before training is complete.
 *
 * To switch to real model:
 *   1. python ml/prepare_dataset.py
 *   2. python ml/train_model.py
 *   3. python ml/export_model.py
 *   4. Restart the server — it will pick up the model automatically.
 */

const path = require('path');
const fs   = require('fs');

// ── Paths ─────────────────────────────────────────────────────────────────
const MODEL_DIR    = path.join(__dirname, '..', 'model');
const ONNX_PATH    = path.join(MODEL_DIR, 'cleanvision.onnx');
const CLASSES_PATH = path.join(MODEL_DIR, 'classes.json');

// ── Class config (loaded from classes.json if available) ──────────────────
let CLASS_CONFIG = {
  classes: ['Muddy-Floor', 'Uncleaned-Floor', 'Stain', 'Rusty-Pipes'],
  penalties: {
    'Muddy-Floor':     25,
    'Uncleaned-Floor': 20,
    'Stain':           10,
    'Rusty-Pipes':      0,   // ← structural issue, NEVER penalised
  },
  conf_threshold: 0.35,
  iou_threshold:  0.45,
  input_size:     640,
};

if (fs.existsSync(CLASSES_PATH)) {
  try {
    CLASS_CONFIG = JSON.parse(fs.readFileSync(CLASSES_PATH, 'utf8'));
    console.log('[cvModel] Loaded class config from classes.json');
  } catch (e) {
    console.warn('[cvModel] Could not parse classes.json, using defaults.');
  }
}

// ── ONNX session (lazily initialised) ────────────────────────────────────
let ort       = null;
let ortSession = null;

async function getOrtSession() {
  if (ortSession) return ortSession;

  if (!fs.existsSync(ONNX_PATH)) return null;

  try {
    ort = require('onnxruntime-node');
    ortSession = await ort.InferenceSession.create(ONNX_PATH, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    console.log('[cvModel] ONNX model loaded:', ONNX_PATH);
    return ortSession;
  } catch (err) {
    console.warn('[cvModel] ⚠  Could not load ONNX model:', err.message);
    return null;
  }
}

// ── Image preprocessing for ONNX (resize → normalise → CHW/HWC tensor) ───────
async function preprocessImage(filePath) {
  const sharp = await import('sharp').catch(() => null);
  if (!sharp) {
    throw new Error('sharp not installed — run: npm install sharp');
  }

  const isMobileNet = CLASS_CONFIG.model_type === 'mobilenetv2_classification';
  const size  = CLASS_CONFIG.input_size || (isMobileNet ? 224 : 640);
  const { data, info } = await sharp.default(filePath)
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (isMobileNet) {
    // Convert HWC uint8 → HWC float32 normalised [-1, 1] for MobileNetV2
    const float32 = new Float32Array(size * size * 3);
    for (let i = 0; i < size * size * 3; i++) {
      float32[i] = (data[i] / 127.5) - 1.0;
    }
    return new ort.Tensor('float32', float32, [1, size, size, 3]);
  } else {
    // Convert HWC uint8 → CHW float32 normalised [0,1] for YOLO
    const float32 = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++) {
      float32[i]                 = data[i * 3]     / 255.0; // R
      float32[i + size * size]   = data[i * 3 + 1] / 255.0; // G
      float32[i + 2 * size * size] = data[i * 3 + 2] / 255.0; // B
    }
    return new ort.Tensor('float32', float32, [1, 3, size, size]);
  }
}

// ── NMS (Non-Maximum Suppression) — filter overlapping boxes ─────────────
function applyNMS(detections, iouThreshold) {
  detections.sort((a, b) => b.conf - a.conf);
  const kept = [];
  const used = new Set();

  for (let i = 0; i < detections.length; i++) {
    if (used.has(i)) continue;
    kept.push(detections[i]);
    for (let j = i + 1; j < detections.length; j++) {
      if (used.has(j)) continue;
      if (iou(detections[i].box, detections[j].box) > iouThreshold) {
        used.add(j);
      }
    }
  }
  return kept;
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const aArea = (a[2]-a[0]) * (a[3]-a[1]);
  const bArea = (b[2]-b[0]) * (b[3]-b[1]);
  return inter / (aArea + bArea - inter + 1e-6);
}

// ── Parse raw ONNX output (YOLOv8 format: [1, 8, 8400]) ──────────────────
function parseYoloOutput(rawOutput, numClasses, confThreshold) {
  // YOLOv8 output shape: [batch=1, 4+numClasses, numAnchors]
  const [batch, channels, anchors] = rawOutput.dims;
  const data = rawOutput.data;
  const detections = [];

  for (let i = 0; i < anchors; i++) {
    // Extract class scores
    let maxConf  = 0;
    let classIdx = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[4 * anchors + c * anchors + i];
      if (score > maxConf) { maxConf = score; classIdx = c; }
    }

    if (maxConf < confThreshold) continue;

    // Extract box (cx, cy, w, h — already normalised to 1)
    const cx = data[0 * anchors + i];
    const cy = data[1 * anchors + i];
    const w  = data[2 * anchors + i];
    const h  = data[3 * anchors + i];

    detections.push({
      box:   [cx - w/2, cy - h/2, cx + w/2, cy + h/2],
      conf:  maxConf,
      class: classIdx,
      label: CLASS_CONFIG.classes[classIdx],
    });
  }
  return detections;
}

// ── Score calculator from detections ─────────────────────────────────────
function calculateScore(detections) {
  let totalPenalty = 0;
  const issueLabels = [];
  const recommendations = [];

  const RECS = {
    'Muddy-Floor':     { issue: 'Mud or debris on floor',         rec: 'Sweep and mop the floor immediately' },
    'Uncleaned-Floor': { issue: 'Uncleaned/wet floor surface',    rec: 'Clean and dry the floor surface' },
    'Stain':           { issue: 'Visible staining on surface',    rec: 'Scrub stained area with cleaning agent' },
    'Rusty-Pipes':     null,  // structural — never reported as an issue
  };

  for (const det of detections) {
    const label = det.label;
    const penalty = CLASS_CONFIG.penalties[label] ?? 0;

    // Rusty-Pipes and anything with 0 penalty → skip entirely
    if (penalty === 0) continue;

    totalPenalty += penalty;

    const info = RECS[label];
    if (info) {
      if (!issueLabels.includes(info.issue)) {
        issueLabels.push(info.issue);
        recommendations.push(info.rec);
      }
    }
  }

  // Cap penalty at 70 (never score below 30 from detections alone)
  const cappedPenalty = Math.min(totalPenalty, 70);
  const score = Math.max(30, 100 - cappedPenalty);

  let status = 'Very Clean';
  if (score < 45)      status = 'Dirty';
  else if (score < 70) status = 'Needs Attention';
  else if (score < 90) status = 'Clean';

  // Confidence: average of detected box confidences (or high default if no issues)
  const avgConf = detections.length > 0
    ? (detections.reduce((s, d) => s + d.conf, 0) / detections.length * 100)
    : 97.5;

  return {
    score,
    status,
    confidence:      parseFloat(avgConf.toFixed(1)),
    issues:          issueLabels,
    recommendations: recommendations.length > 0 ? recommendations : ['No action required'],
    detections:      detections.map(d => ({ label: d.label, confidence: +(d.conf * 100).toFixed(1) })),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MODE A — Real ONNX Inference
// ════════════════════════════════════════════════════════════════════════════
const { Worker } = require('worker_threads');

// Worker pool could be implemented here. For now, we spawn a worker per request.
// In a true production environment, use a library like 'piscina' for a robust worker pool.
async function predictWithONNX(file) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'cvWorker.js');
    const worker = new Worker(workerPath);

    worker.on('message', (msg) => {
      if (msg.error) {
        console.error('[cvModel Worker Error]', msg.error);
        resolve(null); // Fallback to mock if ONNX fails in worker
      } else {
        resolve(msg.result);
      }
      worker.terminate();
    });

    worker.on('error', (err) => {
      console.error('[cvModel Worker Fatal Error]', err);
      resolve(null);
      worker.terminate();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[cvModel Worker] stopped with exit code ${code}`);
        resolve(null);
      }
    });

    worker.postMessage({ filePath: file.path });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// MODE B — Mock Predictor (development fallback)
// ════════════════════════════════════════════════════════════════════════════
async function predictWithMock(file) {
  await new Promise(r => setTimeout(r, 2000)); // simulate processing

  const filename = (file.originalname || '').toLowerCase();
  let score = 90, confidence = 97.1, issues = [], recommendations = [];

  if (filename.includes('muddy') || filename.includes('trash') || filename.includes('dirty')) {
    score = 38; confidence = 93.4;
    issues = ['Mud or debris on floor', 'Uncleaned/wet floor surface'];
    recommendations = ['Sweep and mop the floor immediately', 'Clean and dry the floor surface'];
  } else if (filename.includes('spill') || filename.includes('wet') || filename.includes('uncleaned')) {
    score = 62; confidence = 90.8;
    issues = ['Uncleaned/wet floor surface'];
    recommendations = ['Clean and dry the floor surface'];
  } else if (filename.includes('stain') || filename.includes('mirror')) {
    score = 78; confidence = 95.3;
    issues = ['Visible staining on surface'];
    recommendations = ['Scrub stained area with cleaning agent'];
  } else if (filename.includes('clean') || filename.includes('perfect')) {
    score = 96; confidence = 98.7;
    recommendations = ['No action required'];
  } else {
    const seed = (file.size || 400000) % 30;
    score = 70 + seed;
    confidence = 88 + (seed / 3);
    if (score < 80) {
      issues = ['Visible staining on surface'];
      recommendations = ['Scrub stained area with cleaning agent'];
    } else {
      recommendations = ['No action required'];
    }
  }

  let status = 'Very Clean';
  if (score < 45)      status = 'Dirty';
  else if (score < 70) status = 'Needs Attention';
  else if (score < 90) status = 'Clean';

  return { score, status, confidence: parseFloat(confidence.toFixed(1)), issues, recommendations };
}

// ════════════════════════════════════════════════════════════════════════════
// Main export
// ════════════════════════════════════════════════════════════════════════════
async function predictImage(file, location = {}) {
  // Try real ONNX model first
  const onnxExists = fs.existsSync(ONNX_PATH);

  if (onnxExists) {
    console.log('[cvModel] Running ONNX inference...');
    try {
      const result = await predictWithONNX(file);
      if (result) {
        const timeStr = new Date().toLocaleTimeString();
        const locStr = location.block ? `Room ${location.roomNumber} Block ${location.block}` : 'Unknown Location';
        console.log(`[cvModel] Scan: ${locStr} at ${timeStr} | Score: ${result.score}% | Status: ${result.status} | Issues: ${result.issues.length}`);
        return result;
      }
    } catch (err) {
      console.warn('[cvModel] ONNX inference failed, falling back to mock:', err.message);
    }
  } else {
    console.log('[cvModel] No ONNX model found - using mock predictor (train the model first).');
  }

  const result = await predictWithMock(file);
  const timeStr = new Date().toLocaleTimeString();
  const locStr = location.block ? `Room ${location.roomNumber} Block ${location.block}` : 'Unknown Location';
  console.log(`[cvModel] Scan: ${locStr} at ${timeStr} | Score: ${result.score}% | Status: ${result.status} | Issues: ${result.issues.length}`);
  
  return result;
}

module.exports = { predictImage };
