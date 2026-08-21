/**
 * CleanVision — SQLite Database Layer
 * Uses better-sqlite3 (synchronous, zero-config, file-based)
 * Database file: server/db/cleanvision.db
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_DIR = path.join(__dirname);
const DB_PATH = path.join(DB_DIR, 'cleanvision.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password     TEXT    NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'supervisor'
                         CHECK(role IN ('admin','manager','supervisor')),
    block_access TEXT    DEFAULT 'ALL',
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login   TEXT
  );

  CREATE TABLE IF NOT EXISTS client_reports (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id      TEXT    NOT NULL UNIQUE,
    block          TEXT    NOT NULL,
    floor_number   TEXT    NOT NULL,
    room_number    TEXT    NOT NULL,
    bathroom_id    TEXT    NOT NULL,
    hospital_name  TEXT    NOT NULL DEFAULT 'City General Hospital',
    issue_type     TEXT    NOT NULL DEFAULT 'General Cleanliness',
    notes          TEXT,
    image_url      TEXT,
    status         TEXT    NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    resolved_at    TEXT,
    resolved_by    TEXT
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id              TEXT    PRIMARY KEY,
    timestamp       TEXT    NOT NULL,
    hospitalName    TEXT    NOT NULL,
    block           TEXT    NOT NULL,
    floorNumber     TEXT    NOT NULL,
    roomNumber      TEXT    NOT NULL,
    bathroomId      TEXT,
    inspectorName   TEXT    NOT NULL,
    inspectorId     INTEGER NOT NULL,
    score           INTEGER NOT NULL,
    status          TEXT    NOT NULL,
    confidence      REAL    NOT NULL,
    issues          TEXT    NOT NULL,
    recommendations TEXT    NOT NULL,
    imageUrl        TEXT
  );
`);

// ── Seed default users (only if table is empty) ──────────────────────────────
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;

if (userCount === 0) {
  const seed = db.transaction(() => {
    const insert = db.prepare(`
      INSERT INTO users (name, email, password, role, block_access)
      VALUES (@name, @email, @password, @role, @block_access)
    `);

    const users = [
      {
        name: 'Anonymous 1',
        email: 'admin@hospital.com',
        password: bcrypt.hashSync('Admin@123', 10),
        role: 'admin',
        block_access: 'ALL',
      },
      {
        name: 'Anonymous 2',
        email: 'sarah@hospital.com',
        password: bcrypt.hashSync('Supervisor@123', 10),
        role: 'supervisor',
        block_access: 'A,B',
      },
      {
        name: 'Anonymous 3',
        email: 'robert@hospital.com',
        password: bcrypt.hashSync('Supervisor@123', 10),
        role: 'supervisor',
        block_access: 'C,D',
      },
      {
        name: 'Anonymous 4',
        email: 'maria@hospital.com',
        password: bcrypt.hashSync('Manager@123', 10),
        role: 'manager',
        block_access: 'ALL',
      },
    ];

    // Reset table if existing to update names
    db.exec('DELETE FROM users');
    users.forEach(u => insert.run(u));
  });

  seed();
  console.log('[DB] Seeded default users.');
  console.log('[DB]    admin@hospital.com  / Admin@123');
  console.log('[DB]    sarah@hospital.com  / Supervisor@123');
  console.log('[DB]    maria@hospital.com  / Manager@123');
}

// ── Prepared statements (exported for use in routes) ─────────────────────────
const stmts = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
  findById: db.prepare('SELECT id,name,email,role,block_access,is_active,created_at,last_login FROM users WHERE id = ?'),
  updateLogin: db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?"),
  createUser: db.prepare(`
    INSERT INTO users (name, email, password, role, block_access)
    VALUES (@name, @email, @password, @role, @block_access)
  `),
  listUsers: db.prepare('SELECT id,name,email,role,block_access,is_active,created_at,last_login FROM users ORDER BY id'),
  toggleActive: db.prepare('UPDATE users SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id = ?'),

  // Client Reports Statements
  createClientReport: db.prepare(`
    INSERT INTO client_reports (report_id, block, floor_number, room_number, bathroom_id, hospital_name, issue_type, notes, image_url)
    VALUES (@report_id, @block, @floor_number, @room_number, @bathroom_id, @hospital_name, @issue_type, @notes, @image_url)
  `),
  listClientReports: db.prepare(`
    SELECT * FROM client_reports ORDER BY CASE WHEN status='PENDING' THEN 0 ELSE 1 END, id DESC
  `),
  resolveClientReport: db.prepare(`
    UPDATE client_reports SET status = 'RESOLVED', resolved_at = datetime('now'), resolved_by = ? WHERE report_id = ?
  `),

  // Inspections Statements
  createInspection: db.prepare(`
    INSERT INTO inspections (id, timestamp, hospitalName, block, floorNumber, roomNumber, bathroomId, inspectorName, inspectorId, score, status, confidence, issues, recommendations, imageUrl)
    VALUES (@id, @timestamp, @hospitalName, @block, @floorNumber, @roomNumber, @bathroomId, @inspectorName, @inspectorId, @score, @status, @confidence, @issues, @recommendations, @imageUrl)
  `),
  listInspectionsAll: db.prepare(`
    SELECT * FROM inspections ORDER BY timestamp DESC
  `),
  listInspectionsByInspector: db.prepare(`
    SELECT * FROM inspections WHERE inspectorId = ? ORDER BY timestamp DESC
  `)
};

module.exports = { db, stmts };
