import Database from 'better-sqlite3';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'schedule.db'));
const app = express();

app.use(cors());
app.use(express.json());

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS schedule_entries (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL,
    activity TEXT NOT NULL,
    day TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    staff TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS staff_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );
`);

// Seed default staff if empty
const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff_members').get();
if (staffCount.c === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO staff_members (id, name) VALUES (?, ?)');
  ['Team Member 1', 'Team Member 2', 'Team Member 3'].forEach(name =>
    insert.run(randomUUID(), name)
  );
}

// --- Staff endpoints ---
app.get('/api/staff', (_req, res) => {
  res.json(db.prepare('SELECT * FROM staff_members ORDER BY name').all());
});

app.post('/api/staff', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const id = randomUUID();
  try {
    db.prepare('INSERT INTO staff_members (id, name) VALUES (?, ?)').run(id, name.trim());
    res.status(201).json({ id, name: name.trim() });
  } catch {
    res.status(409).json({ error: 'Staff member already exists' });
  }
});

app.delete('/api/staff/:id', (req, res) => {
  db.prepare('DELETE FROM staff_members WHERE id = ?').run(req.params.id);
  res.sendStatus(204);
});

// --- Schedule endpoints ---
app.get('/api/schedule/:weekStart', (req, res) => {
  const entries = db
    .prepare('SELECT * FROM schedule_entries WHERE week_start = ? ORDER BY day, time_slot')
    .all(req.params.weekStart);
  res.json(entries);
});

app.post('/api/schedule', (req, res) => {
  const { week_start, activity, day, time_slot, staff, notes } = req.body;
  if (!week_start || !activity || !day || !time_slot || !staff)
    return res.status(400).json({ error: 'Missing required fields' });
  const id = randomUUID();
  db.prepare(
    'INSERT INTO schedule_entries (id, week_start, activity, day, time_slot, staff, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, week_start, activity, day, time_slot, staff, notes || '');
  res.status(201).json({ id, week_start, activity, day, time_slot, staff, notes: notes || '' });
});

app.put('/api/schedule/:id', (req, res) => {
  const { activity, day, time_slot, staff, notes } = req.body;
  db.prepare(
    'UPDATE schedule_entries SET activity=?, day=?, time_slot=?, staff=?, notes=? WHERE id=?'
  ).run(activity, day, time_slot, staff, notes || '', req.params.id);
  res.json({ id: req.params.id, activity, day, time_slot, staff, notes });
});

app.delete('/api/schedule/:id', (req, res) => {
  db.prepare('DELETE FROM schedule_entries WHERE id = ?').run(req.params.id);
  res.sendStatus(204);
});

// Serve built frontend
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AP Scheduler running on port ${PORT}`));
