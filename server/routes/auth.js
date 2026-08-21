/**
 * CleanVision — Auth Routes
 * POST /api/auth/login   — email + password → JWT
 * POST /api/auth/register — admin-only user creation
 * GET  /api/auth/me      — returns current user from token
 * GET  /api/auth/users   — admin: list all users
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { stmts } = require('../db/database');

const router = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET || 'cleanvision-jwt-secret-change-in-prod';
const JWT_EXPIRES = '7d';

// ── Middleware: verify JWT ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ── Middleware: require admin role ───────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = stmts.findByEmail.get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is disabled. Contact admin.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Update last login timestamp
  stmts.updateLogin.run(user.id);

  // Sign JWT
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, block_access: user.block_access },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return res.json({
    token,
    user: {
      id:           user.id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      block_access: user.block_access,
    },
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = stmts.findById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
});

// ── POST /api/auth/register  (admin only) ────────────────────────────────────
router.post('/register', requireAuth, requireAdmin, (req, res) => {
  const { name, email, password, role = 'supervisor', block_access = 'ALL' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = stmts.findByEmail.get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hashed = bcrypt.hashSync(password, 10);

  try {
    stmts.createUser.run({ name, email, password: hashed, role, block_access });
    return res.status(201).json({ message: `User ${name} created successfully.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

// ── GET /api/auth/users  (admin only) ────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = stmts.listUsers.all();
  res.json(users);
});

// ── PATCH /api/auth/users/:id/toggle  (admin only) ───────────────────────────
router.patch('/users/:id/toggle', requireAuth, requireAdmin, (req, res) => {
  stmts.toggleActive.run(req.params.id);
  res.json({ message: 'User status toggled.' });
});

module.exports = { router, requireAuth };
