const express = require('express');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const EDITOR_PORT = Number(process.env.EDITOR_PORT || 3000);
const VIEWER_PORT = Number(process.env.VIEWER_PORT || 3001);
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || 'playbook';
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || 'playbook-edit';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'playbook.db');

// SQLite setup
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    label TEXT NOT NULL DEFAULT '',
    offense_playbook TEXT NOT NULL,
    defense_playbook TEXT NOT NULL,
    custom_formations TEXT NOT NULL DEFAULT '[]'
  )
`);

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

function requestPort(req) {
  return Number(req.socket.localPort);
}

function isEditorPort(req) {
  return requestPort(req) === EDITOR_PORT;
}

function isViewerPort(req) {
  return requestPort(req) === VIEWER_PORT;
}

function buildPortUrl(req, port, pathname) {
  const url = new URL(`${req.protocol}://${req.get('host')}`);
  url.port = String(port);
  url.pathname = pathname;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function requireEditorPortPage(req, res, next) {
  if (isEditorPort(req)) return next();
  res.redirect(buildPortUrl(req, EDITOR_PORT, '/'));
}

function requireViewerPortPage(req, res, next) {
  if (isViewerPort(req)) return next();
  res.redirect(buildPortUrl(req, VIEWER_PORT, '/'));
}

function requireEditorPortApi(req, res, next) {
  if (isEditorPort(req)) return next();
  res.status(404).json({ error: `Use the editor port (${EDITOR_PORT}) for this endpoint.` });
}

function requireViewerPortApi(req, res, next) {
  if (isViewerPort(req)) return next();
  res.status(404).json({ error: `Use the viewer port (${VIEWER_PORT}) for this endpoint.` });
}

// ---- Viewer Auth ----
function requireViewerAuth(req, res, next) {
  if (req.cookies.viewer_auth === VIEWER_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ---- Editor Auth ----
function requireEditorAuth(req, res, next) {
  if (req.cookies.editor_auth === EDITOR_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ---- Page Routes ----
app.get('/', (req, res) => {
  if (isViewerPort(req)) {
    if (req.cookies.viewer_auth === VIEWER_PASSWORD) {
      res.sendFile(path.join(__dirname, 'viewer.html'));
    } else {
      res.redirect('/viewer/login');
    }
    return;
  }

  if (req.cookies.editor_auth === EDITOR_PASSWORD) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.redirect('/editor/login');
  }
});

app.get('/editor/login', requireEditorPortPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'editor-login.html'));
});

app.get('/editor', requireEditorPortPage, (req, res) => {
  if (req.cookies.editor_auth === EDITOR_PASSWORD) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.redirect('/editor/login');
  }
});

app.get('/viewer/login', requireViewerPortPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer-login.html'));
});

app.get('/viewer', requireViewerPortPage, (req, res) => {
  if (req.cookies.viewer_auth === VIEWER_PASSWORD) {
    res.sendFile(path.join(__dirname, 'viewer.html'));
  } else {
    res.redirect('/viewer/login');
  }
});

// ---- Static Files ----
// Block direct access to editor HTML (must go through auth routes above)
app.get('/index.html', (req, res) => res.redirect('/'));
app.get('/viewer.html', (req, res) => res.redirect('/'));
app.use(express.static(__dirname));

// ---- Store API (existing) ----
app.get('/api/store/:key', requireEditorPortApi, (req, res) => {
  const row = db.prepare('SELECT value FROM store WHERE key = ?').get(req.params.key);
  res.json({ value: row ? row.value : null });
});

app.put('/api/store/:key', requireEditorPortApi, requireEditorAuth, (req, res) => {
  const { value } = req.body;
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value must be a string' });
  }
  db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run(req.params.key, value);
  res.json({ ok: true });
});

// ---- Versioning API ----
app.post('/api/publish', requireEditorPortApi, requireEditorAuth, (req, res) => {
  const label = (req.body && req.body.label) || '';
  const offense = db.prepare('SELECT value FROM store WHERE key = ?').get('7on7-playbook');
  const defense = db.prepare('SELECT value FROM store WHERE key = ?').get('7on7-defensive-playbook');
  const formations = db.prepare('SELECT value FROM store WHERE key = ?').get('7on7-custom-formations');

  if (!offense || !offense.value) {
    return res.status(400).json({ error: 'No playbook data to publish' });
  }

  const stmt = db.prepare(`
    INSERT INTO versions (label, offense_playbook, defense_playbook, custom_formations)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    label,
    offense.value,
    defense ? defense.value : '[]',
    formations ? formations.value : '[]'
  );

  const row = db.prepare('SELECT id, published_at, label FROM versions WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

app.get('/api/versions', requireEditorPortApi, (req, res) => {
  const rows = db.prepare('SELECT id, published_at, label FROM versions ORDER BY id DESC').all();
  res.json(rows);
});

// ---- Editor API ----
app.post('/api/editor/login', requireEditorPortApi, (req, res) => {
  const { password } = req.body || {};
  if (password === EDITOR_PASSWORD) {
    res.cookie('editor_auth', EDITOR_PASSWORD, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax',
      secure: req.secure
    });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// ---- Viewer API ----
app.post('/api/viewer/login', requireViewerPortApi, (req, res) => {
  const { password } = req.body || {};
  if (password === VIEWER_PASSWORD) {
    res.cookie('viewer_auth', VIEWER_PASSWORD, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax',
      secure: req.secure
    });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.get('/api/published', requireViewerPortApi, requireViewerAuth, (req, res) => {
  const row = db.prepare(`
    SELECT id, published_at, label, offense_playbook, defense_playbook, custom_formations
    FROM versions ORDER BY id DESC LIMIT 1
  `).get();

  if (!row) {
    return res.status(404).json({ error: 'No published version' });
  }

  res.json({
    id: row.id,
    published_at: row.published_at,
    label: row.label,
    offensePlaybook: row.offense_playbook,
    defensePlaybook: row.defense_playbook,
    customFormations: row.custom_formations
  });
});

app.listen(EDITOR_PORT, () => {
  console.log(`Editor running at http://localhost:${EDITOR_PORT}`);
});

if (VIEWER_PORT !== EDITOR_PORT) {
  app.listen(VIEWER_PORT, () => {
    console.log(`Viewer running at http://localhost:${VIEWER_PORT}`);
  });
} else {
  console.log(`Viewer shares the editor port at http://localhost:${EDITOR_PORT}`);
}
