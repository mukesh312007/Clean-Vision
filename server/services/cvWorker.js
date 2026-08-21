const { parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');

// ── Paths ─────────────────────────────────────────────────────────────────
const MODEL_DIR    = path.join(__dirname, '..', 'model');
const ONNX_PATH    = path.join(MODEL_DIR, 'cleanvision.onnx');
const CLASSES_PATH = path.join(MODEL_DIR, 'classes.json');

// ── Class config ──────────────────────────────────────────────────────────
let CLASS_CONFIG = {
  classes: ['Muddy-Floor', 'Uncleaned-Floor', 'Stain', 'Rusty-Pipes'],
  penalties: {
    'Muddy-Floor':     25,
    'Uncleaned-Floor': 20,
    'Stain':           10,
    'Rusty-Pipes':      0,
  },
  conf_threshold: 0.35,
  iou_threshold:  0.45,
  input_size:     640,
};

if (fs.existsSync(CLASSES_PATH)) {
  try {
    CLASS_CONFIG = JSON.parse(fs.readFileSync(CLASSES_PATH, 'utf8'));
  } catch (e) {
    // Ignore, use defaults
  }
}

let ort = null;
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
    return ortSession;
  } catch (err) {
    return null;
  }
}

async function preprocessImage(filePath) {
  const sharp = await import('sharp').catch(() => null);
  if (!sharp) throw new Error('sharp not installed');

  const isMobileNet = CLASS_CONFIG.model_type === 'mobilenetv2_classification';
  const size  = CLASS_CONFIG.input_size || (isMobileNet ? 224 : 640);
  const { data, info } = await sharp.default(filePath)
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (isMobileNet) {
    const float32 = new Float32Array(size * size * 3);
    for (let i = 0; i < size * size * 3; i++) {
      float32[i] = (data[i] / 127.5) - 1.0;
    }
    return new ort.Tensor('float32', float32, [1, size, size, 3]);
  } else {
    const float32 = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++) {
      float32[i]                 = data[i * 3]     / 255.0;
      float32[i + size * size]   = data[i * 3 + 1] / 255.0;
      float32[i + 2 * size * size] = data[i * 3 + 2] / 255.0;
    }
    return new ort.Tensor('float32', float32, [1, 3, size, size]);
  }
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const aArea = (a[2]-a[0]) * (a[3]-a[1]);
  const bArea = (b[2]-b[0]) * (b[3]-b[1]);
  return inter / (aArea + bArea - inter + 1e-6);
}

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

function parseYoloOutput(rawOutput, numClasses, confThreshold) {
  const [batch, channels, anchors] = rawOutput.dims;
  const data = rawOutput.data;
  const detections = [];

  for (let i = 0; i < anchors; i++) {
    let maxConf  = 0;
    let classIdx = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[4 * anchors + c * anchors + i];
      if (score > maxConf) { maxConf = score; classIdx = c; }
    }

    if (maxConf < confThreshold) continue;

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

function calculateScore(detections) {
  let totalPenalty = 0;
  const issueLabels = [];
  const recommendations = [];

  const RECS = {
    'Muddy-Floor':     { issue: 'Mud or debris on floor',         rec: 'Sweep and mop the floor immediately' },
    'Uncleaned-Floor': { issue: 'Uncleaned/wet floor surface',    rec: 'Clean and dry the floor surface' },
    'Stain':           { issue: 'Visible staining on surface',    rec: 'Scrub stained area with cleaning agent' },
    'Rusty-Pipes':     null,
  };

  for (const det of detections) {
    const label = det.label;
    const penalty = CLASS_CONFIG.penalties[label] ?? 0;
    if (penalty === 0) continue;

    totalPenalty += penalty;
    const info = RECS[label];
    if (info && !issueLabels.includes(info.issue)) {
      issueLabels.push(info.issue);
      recommendations.push(info.rec);
    }
  }

  const cappedPenalty = Math.min(totalPenalty, 70);
  const score = Math.max(30, 100 - cappedPenalty);

  let status = 'Very Clean';
  if (score < 45)      status = 'Dirty';
  else if (score < 70) status = 'Needs Attention';
  else if (score < 90) status = 'Clean';

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

parentPort.on('message', async (message) => {
  try {
    const { filePath } = message;
    const session = await getOrtSession();
    if (!session) {
      parentPort.postMessage({ error: 'ONNX session could not be created' });
      return;
    }

    const inputTensor = await preprocessImage(filePath);
    const isMobileNet = CLASS_CONFIG.model_type === 'mobilenetv2_classification';
    
    if (isMobileNet) {
      const inputName = session.inputNames[0];
      const feeds = { [inputName]: inputTensor };
      const output = await session.run(feeds);
      const outputName = session.outputNames[0];
      const pred = output[outputName].data[0];
      
      const score = (1.0 - pred) * 100;
      const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
      
      let status = 'Very Clean';
      if (roundedScore < 45)      status = 'Dirty';
      else if (roundedScore < 70) status = 'Needs Attention';
      else if (roundedScore < 90) status = 'Clean';

      let issues = [];
      let recommendations = [];

      if (roundedScore < 45) {
        issues = ['Unclean floor surface', 'Visible dirt or debris'];
        recommendations = ['Sweep, mop, and sanitize the floor surface immediately'];
      } else if (roundedScore < 70) {
        issues = ['Minor surface staining or wet spots'];
        recommendations = ['Clean and dry the floor surface'];
      } else {
        recommendations = ['No action required'];
      }

      const confidence = parseFloat((Math.max(pred, 1.0 - pred) * 100).toFixed(1));

      parentPort.postMessage({
        result: {
          score: roundedScore,
          status,
          confidence,
          issues,
          recommendations,
          detections: []
        }
      });
    } else {
      const feeds  = { images: inputTensor };
      const output = await session.run(feeds);
      const rawOutput = output['output0'] || Object.values(output)[0];
      const detections = parseYoloOutput(rawOutput, CLASS_CONFIG.classes.length, CLASS_CONFIG.conf_threshold);
      const filtered   = applyNMS(detections, CLASS_CONFIG.iou_threshold);
      
      parentPort.postMessage({ result: calculateScore(filtered) });
    }
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});
